const Problem = require('../models/problem.model');
const Course = require("../models/course.model");

let problemController = {};

problemController.getProblem = async function (req, res) {
	try {
		const {problemId} = req.params;
		const problem = await Problem.findById(problemId);
		if (!problem) throw Error('Cannot find a problem that matches this id.');
		// We don't need to populate 'course_id' because the course is already known
		res.status(200).json(problem);
	} catch (e) {
		res.status(400).json({ error: e.message });
	}
};

problemController.getProblems = async function(req, res) {
	try {
		const problems = await Problem.find();
		if (!problems) throw Error('Cannot find any problem in the Problem table.');
		res.status(200).json(problems);
	} catch (e) {
		res.status(400).json({ error: e.message });
	}
};

problemController.createProblem = async function(req, res) {
	const {name, description, mark, runtime_limit, deadline} = req.body;
	const {courseId, userId} = res.locals;
	const newProblem = new Problem({
		name: name,
		description: description,
		mark: mark,
		runtime_limit: runtime_limit,
		deadline: deadline,
		course_id: courseId
	});

	try {
		const adminId = await Course.findById(courseId, 'admin_id');
		if (!adminId) throw Error('Cannot match course id provided in problem creation with an entry in Courses.');
		if (adminId != userId) {
			throw Error('User trying to create a problem is not an administrator of this course.')
		}

		if (await newProblem.save()) {
			res.status(200).json(newProblem);
		} else {
			throw Error('Cannot save the new problem in the database.');
		}
	} catch (e) {
		res.status(400).json({error: e.message});
	}
};

problemController.deleteProblem = async function(req, res) {
	const {problemId} = req.params;
	const {courseId, userId} = res.locals;

	try {
		const adminId = await Course.findById(courseId, 'admin_id');
		if (!adminId) throw Error('Cannot match course id provided in problem deletion with an entry in Courses.');
		if (adminId != userId) {
			throw Error('User trying to delete a problem is not an administrator of this course.')
		}

		if (await Problem.deleteOne({_id: problemId})) {
			res.status(200).json({success: true});
		} else {
			throw Error('Cannot delete this problem.');
		}

	} catch (e) {
		res.status(400).json({error: e.message, success: false});
	}
};

problemController.updateProblem = async function(req, res) {
	const {name, description, mark, runtime_limit, deadline} = req.body;
	const {problemId} = req.params;
	const {courseId, userId} = res.locals;

	try {
		const adminId = await Course.findById(courseId, 'admin_id');
		if (!adminId) throw Error('Cannot match course id provided in problem update with an entry in Courses.');
		if (adminId != userId) {
			throw Error('User trying to update a problem is not an administrator of this course.')
		}

		const updatedProblem = await Problem.updateOne({_id: problemId}, {name, description, mark, runtime_limit, deadline}, {runValidators: true});
		if (!updatedProblem) {
			throw Error('Cannot update this problem.');

		}
		res.status(200).json({updatedProblem, success: true});

	} catch (e) {
		res.status(400).json({error: e.message, success: false});
	}
};

module.exports = problemController;