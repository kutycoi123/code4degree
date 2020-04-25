const Course = require("../models/course.model");
const Problem = require("../models/problem.model");
const ProblemSubmission = require("../models/problem_submission.model");
const JudegeSubmission = require("../models/judge_submission.model");
const Testcase = require("../models/testcase.model");
const {languageMap, statusId, statusMap} = require("../models/constants");
const axios = require("axios");


function getJudgePostSubmissionUrl(){
    return "https://api.judge0.com/submissions/?base64_encoded=true&wait=false";
}

function getJudgeGetSubmissionUrl(token){
    return `https://api.judge0.com/submissions/${token}?base64_encoded=true`;
}

module.exports = {
    getProblemSubmission: async (req, res, next) => {
        const {problemId} = res.locals;
        const userId = req.user_id;
        const {submissionId} = req.params;
        try{
            const submission = (await ProblemSubmission.findById(submissionId))
                                .populate('judge_submission_ids').populate("testcase_results");
            if(!submission) 
                return res.status(404).json({error: "Submission not found"});
            if(submission.userId != userId)
                return res.status(400).json({error: "You are not owner of requested submission"});
            if(submission.problemId != problemId)
                return res.status(404).json({error: "Submission not found with provided problem"});
            return res.status(200).json(submission);
        }catch(e){
            return res.status(500).json({error: "Internal server error"});
        }
    },

    getProblemSubmissions: async (req, res, next) => {
        const {problemId, courseId} = res.locals;
        const userId = req.user_id;
        const {passed, latest} = req.query;
        let filter = {
            problem_id: problemId,
        };
        try{
            const foundCourse = await Course.findById(courseId);
            if(!foundCourse){
                return res.status(404).json({error: "Problem not found"});
            }
            if(foundCourse.admin_id != userId){
               filter.user_id = userId; 
            }
        }catch(e){
            console.log(e);
            return res.status(500).json({error: "Internal server error"});
        }
        let sort={};
        if(latest != undefined){
            sort.created_at = -1;
        }
        if(passed != undefined){
            filter.passed = passed;
        }
        try{
            let submissions = await ProblemSubmission.find(filter,null, {sort: {...sort}});
            if(latest){
                submissions = submissions.slice(0, 1);
            }
            return res.status(200).json(submissions);
        }catch(e){
            console.log(e);
            return res.status(500).json({error: "Internal server error"});
        }
    },

    //Create submission for each test case and send them to judge0 api to compile
    //Return http status 200 with problem object if there is no error
    //Return http status 400 with compile_error if the submitted has compiled error
    //Return http status 500 otherwise.
    createProblemSubmission: async (req, res, next) => {
        const {courseId, problemId} = res.locals;
        const userId = req.user_id;
        const passedSubmission = await ProblemSubmission.
                                            find({user_id: userId, problem_id: problemId, passed: true});
        if(passedSubmission.length > 0){
            return res.status(400).json({error: "Cannot submit code for a passed problem"});
        }
        const {source_code, language_id, created_at = new Date()} = req.body;
        if(!language_id){
            return res.status(404).json({error: "Submission needs a language_id value"})
        }
        const language = languageMap.find(e => e.id == language_id);
        if(!language)
            return res.status(422).json({error: `Language with id ${language_id} doesn't exist`});
        let problem;
        try{
            problem = await Problem.findById(problemId).populate('course_id');
            if(!problem)
                return res.status(404).json({error: "Problem not found"});
            if(problem.course_id.admin_id == userId)
                return res.status(400).json({error: "Admin is not allower to submit code for this problem"});
            if(new Date(created_at) - new Date(problem.created_at) > 0)
                return res.status(400).json({error: "Submission is not accepted because of overdue"});
        }catch(e){
            console.log(e);
            return res.status(500).json({error: "Internal server error"});
        }
        const problemSub = new ProblemSubmission({source_code, 
                                                  language, 
                                                  problem_id: problemId,
                                                  user_id: userId,
                                                  created_at});
        //Query for all test cases of problem
        let testcases = [];
        try{
            testcases = await Testcase.find({problem_id: problemId});
        }catch(e){
            console.log(e);
            return res.staus(500).json({error: "Internal server error"});
        } 

        //Call third-party api to execute judge submission
        const judgeSubmissions = [];
        for(let i = 0; i < testcases.length; ++i){
            const {_id, expected_output, stdin} = testcases[i];
            let judgeSubmission = new JudegeSubmission({
                                    testcase_id: _id});
            try{
                const sub = await axios.post(getJudgePostSubmissionUrl(), {
                                source_code: Buffer.from(source_code).toString('base64'),
                                language_id,
                                expected_output,
                                stdin,
                                runtime_limit: problem.runtime_limit
                            });
                judgeSubmission.token = sub.data.token;
                judgeSubmissions.push(judgeSubmission);
                problemSub.testcase_results.push({testcase_id: _id});
            }catch(e){
                console.log(e)
                return res.status(500).json({error: "Internal server error"});
            }
        }

        const promises = [];
        //Retrieve judge submisison result from third-party api
        setTimeout(async () => {
            judgeSubmissions.forEach(({token}) => {
                try{
                    const sub = axios.get(getJudgeGetSubmissionUrl(token));
                    promises.push(sub);
                }catch(e){
                    console.log(e);
                    return res.status(500).json({error: "Internal server error"});
                }
            });
            //Once all promises are resolved
            axios.all(promises).then(axios.spread(async (...responses) => {
                for(let i = 0; i < responses.length; ++i){
                    let response = responses[i];
                    let sub = judgeSubmissions.find(e => e.token == response.data.token);
                    const {memory, time, status, compile_output, stdout, stderr} = response.data;
                    sub.memory = memory;
                    sub.time = time;
                    sub.status = status;
                    if(stdout)
                        sub.stdout = Buffer.from(stdout, 'base64').toString('ascii');
                    if(statusId.RUNTIME_ERRORS.includes(status.id) || status.id == 6){
                        problemSub.judge_submission_ids.push(sub._id);
                        problemSub.status = status;
                        try{
                            await problemSub.save();
                        }catch(e){
                            console.log(e);
                            res.status(500).json({error: "Internal server error"});
                        }
                        if(status.id == 6){
                            return res.status(404).json({
                            //Decode the error since judge0 api will return encoded error
                            compile_error: Buffer.from(compile_output, 'base64').toString('utf8')}) ;
                        }
                        return res.status(404).json({
                            runtime_error: Buffer.from(stderr, 'base64').toString('ascii')
                        });
                    }
                };
                let acceptedSub = 0;
                let wrongAnswerStatus = null, runtimeErrorStatus = null;
                for(let i = 0; i < judgeSubmissions.length; ++i){
                    let judge = judgeSubmissions[i];
                    try{
                        await judge.save();
                        problemSub.judge_submission_ids.push(judge._id);
                    }catch(e){
                        console.log(e);
                        return res.status(500).json({error: "Internal server error"});
                    }
                    let test = problemSub.testcase_results.find(e => judge.testcase_id == e.testcase_id);
                    if(test){
			test.stdout = judge.stdout;
                        if(judge.status.id == statusId.ACCEPTED){
                            acceptedSub++;
                            test.result = true;
                        }else if(judge.status.id > statusId.ACCEPTED){ //Compilation error, wrong answer or runtime error
                            test.result = false;
                            if(judge.status.id == statusId.WRONG_ANSWER)
                                wrongAnswerStatus = true;
                            if(statusId.RUNTIME_ERRORS.includes(judge.status.id)){
                                runtimeErrorStatus = true;
                            }
                                
                        }
                    }
                    if(judgeSubmissions.length!= 0)
                        problemSub.result = acceptedSub / judgeSubmissions.length;
                }
                if(runtimeErrorStatus){
                    problemSub.status = statusMap[statusId.RUNTIME_ERROR_GENERAL];
                }else if(wrongAnswerStatus){
                    problemSub.status = statusMap[statusId.WRONG_ANSWER];
                }else{
                    problemSub.status = statusMap[statusId.ACCEPTED];
                    problemSub.passed = true;
                }
                problemSub.save(err => {
                    if(err){
                        console.log(err);
                        return res.status(500).json({error: "Internal server error"});
                    }
                    ProblemSubmission.populate(problemSub, [
                        {path: 'problem_id'},
                        {path: 'testcase_ids'}], (err, problemSub) => {
                            if(err){
                                console.log(err);
                                return res.status(500).json({error: "Internal server error"});
                            }
                            return res.status(200).json(problemSub);
                        })
                });
            })).catch(e => {
                console.log(e);
                return res.status(500).json({error: "Internal server error"});
            });
        }, 1000);
        
    },

    testCodeSubmission: async (req, res, next) => {
        const {problemId} = res.locals;
        const {source_code, language_id} = req.body;
        if(!language_id){
            return res.status(404).json({error: "Submission needs a language_id value"})
        }
        const language = languageMap.find(e => e.id == language_id);
        if(!language)
            return res.status(422).json({error: `Language with id ${language_id} doesn't exist`});
        let problem;
        try{
            problem = await Problem.findById(problemId);
            if(!problem)
                return res.status(404).json({error: "Problem not found"});
        }catch(e){
            console.log(e);
            return res.status(500).json({error: "Internal server error"});
        }
        //Query for all test cases of problem
        let testcases = [];
        try{
            testcases = await Testcase.find({problem_id: problemId, hidden: false});
        }catch(e){
            console.log(e);
            return res.staus(500).json({error: "Internal server error"});
        }

        const judgeSubmissions = [], testcase_results = [];
        for(let i = 0; i < testcases.length; ++i){
            const {_id, expected_output, stdin} = testcases[i];
            let judgeSubmission = new JudegeSubmission({
                                    testcase_id: _id});
            try{
                const sub = await axios.post(getJudgePostSubmissionUrl(), {
                                source_code: Buffer.from(source_code).toString('base64'),
                                language_id,
                                expected_output,
                                stdin,
                                runtime_limit: problem.runtime_limit,
                            });
                judgeSubmission.token = sub.data.token;
                judgeSubmissions.push(judgeSubmission);
                testcase_results.push({testcase_id: _id});
            }catch(e){
                console.log(e)
                return res.status(500).json({error: "Internal server error"});
            }
        }

        let promises = []
        setTimeout(async () => {
            judgeSubmissions.forEach(({token}) => {
                try{
                    const sub = axios.get(getJudgeGetSubmissionUrl(token));
                    promises.push(sub);
                }catch(e){
                    console.log(e);
                    return res.status(500).json({error: "Internal server error"});
                }
            });
            //Once all promises are resolved
            axios.all(promises).then(axios.spread(async (...responses) => {
                for(let i = 0; i < responses.length; ++i){
                    let response = responses[i];
                    let sub = judgeSubmissions.find(e => e.token == response.data.token);
                    const {memory, time, status, compile_output, stdout, stderr} = response.data;
                    sub.memory = memory;
                    sub.time = time;
                    sub.status = status;
                    if(stdout)
                        sub.stdout = Buffer.from(stdout, 'base64').toString('ascii');
                    if(statusId.RUNTIME_ERRORS.includes(status.id)){
                        return res.status(404).json({
                            runtime_error: Buffer.from(stderr, 'base64').toString('ascii')
                        });
                    }
                    if(status.id == 6){
                        return res.status(404).json({
                            //Decode the error since judge0 api will return encoded error
                            compile_error: Buffer.from(compile_output, 'base64').toString('utf8')                        }) ;
                    }
                }
                for(judge of judgeSubmissions){
                    let test = testcase_results.find(e => judge.testcase_id == e.testcase_id);
                    if(test){
                        test.result = judge.status.id == 3;
                        test.stdout = judge.stdout;
                    }
                }
                return res.json({testcase_results});
                
            }))

        }, 1000);
    }
}
