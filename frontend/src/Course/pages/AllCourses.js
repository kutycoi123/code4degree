import React ,{useState, useEffect, useContext} from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Card from '@material-ui/core/Card';
import CardActions from '@material-ui/core/CardActions';
import CardContent from '@material-ui/core/CardContent';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import Container from '@material-ui/core/Container';
import DeleteIcon from '@material-ui/icons/Delete';
import IconButton from '@material-ui/core/IconButton';
import EditIcon from '@material-ui/icons/Edit';
import AddIcon from '@material-ui/icons/Add';
import Divider from '@material-ui/core/Divider';
import Modal from '@material-ui/core/Modal';
import ToolTip from '@material-ui/core/Tooltip';
import Button from '@material-ui/core/Button';
import {AuthContext} from '../../shared/context/auth-context';
import axios from 'axios';
import CourseForm from '../../shared/components/CourseForm';


function getModalStyle() {
  const top = 50;
  const left = 50;

  return {
    top: `${top}%`,
    left: `${left}%`,
    transform: `translate(-${top}%, -${left}%)`,
  };
}
const useStyles = makeStyles(theme => ({
      modalTitle: {  
      textAlign: "center"
      },
      icon: {
        marginRight: theme.spacing(2),
      },
      heroContent: {
        backgroundColor: theme.palette.background.paper,
        padding: theme.spacing(8, 0, 6),
      },
      heroButtons: {
        marginTop: theme.spacing(4),
      },
      cardGrid: {
        paddingTop: theme.spacing(8),
        paddingBottom: theme.spacing(8),
      },
      card: {
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      },
      cardMedia: {
        paddingTop: '56.25%', // 16:9
      },
      cardContent: {
        flexGrow: 1,
      },
      footer: {
        backgroundColor: theme.palette.background.paper,
        padding: theme.spacing(6),
      },
      iconAlignRight: {
          marginLeft:'auto' 
      },
      courseGroupHeader: {
        display: 'flex'
      },
      courseGroup: {
        marginTop: 20
      },
      modalBox: {
        position: 'absolute',
        width: "70%",
        backgroundColor: theme.palette.background.paper,
        border: '1px solid black',
        boxShadow: theme.shadows[5],
        padding: theme.spacing(2, 4, 3),
      }
}));
export default function AllCourses(props){
    
    //Context
    const auth = useContext(AuthContext);

    //Modal
    const modalStyle = getModalStyle();
    const [open, setOpen] = useState(false);
    const [modalState, setModalState] = useState({});
    const handleOpenModal = (title, buttonTitle, defaultValueMap, onSubmit) => {
      // setOpen(true);
      setModalState({title, buttonTitle, defaultValueMap, onSubmit});
      setOpen(true);
    }
    const handleCloseModal = () => {
      setModalState({});
      setOpen(false);
    }
    const classes = useStyles();
    const [allCourses, setAllCourses] = useState([]);
    const [course, setCourse] = useState([]);
      useEffect(() => {
        const token = localStorage.getItem('token');
        axios({
          url: 'http://localhost:5000/api/courses',
          headers: {
            "x-auth-token": token
          }
        }).then((res) => {
          console.log(res);
          const allCourses = res.data;
          setAllCourses(allCourses);
        }).catch(err => {
          console.log(err);
        });
      }, []);

    let handleCreateCourse = (data) => {
        const token = localStorage.getItem('token');
        axios({
          url: 'http://localhost:5000/api/courses',
          method: "post",
          data: data,
          headers: {
            "x-auth-token": token
          }
        }).then(res => {
          const newCourse = res.data;
          setAllCourses([...allCourses, newCourse]);
          setOpen(false);
        }).catch(err => {
          console.log(err);
        })
    }

    let handleEditCourse = (updatedCourse) => {
      const token = localStorage.getItem('token');
      axios({
        url: 'http://localhost:5000/api/courses/' + updatedCourse._id,
        method: "put",
        data: updatedCourse,
        headers: {
          "x-auth-token": token
        }
      }).then(res => {
        const newCourses = allCourses.map(e => {
          if(e._id == updatedCourse._id)
            return updatedCourse;
          return e;
        })
        setAllCourses(newCourses);
        setOpen(false);
      }).catch(err => {
        console.log(err);
      })
  } 
    let handleDeleteCourse = (id) => {
        const token = localStorage.getItem('token');
        axios({
            url: 'http://localhost:5000/api/courses/' + id,
            method: "delete",
            headers: {
                "x-auth-token": token
            }
        }).then(res => {
            const newCourses = allCourses.filter(e => {
              return e._id != id;
            });
            console.log(newCourses);
            setAllCourses(newCourses);
        }).catch(err => {
            console.log(err);
        })
    }

    return(
    <main>
        <Container className={classes.cardGrid} maxWidth="md">
          <div className={classes.main}  >
            <Modal onClose={handleCloseModal} open={open}>
                <div style={modalStyle} className={classes.modalBox}>
                  <h1 className={classes.modalTitle}> {modalState.title}</h1>
                   <CourseForm
                      buttonTitle={modalState.buttonTitle}
                      defaultValueMap={modalState.defaultValueMap}
                      //onSubmit={(data) => handleCreateCourse(data)}
                      onSubmit={modalState.onSubmit}
                   />
                </div>
            </Modal>
            <div className={classes.courseGroupHeader}  >
              <Typography variant="h4" > 
                Administrative Courses
              </Typography>
              <ToolTip title="Create course" placement="top">
                <IconButton 
                    color="primary" 
                    className={classes.iconAlignRight} 
                    onClick={() => handleOpenModal("Adding new course", "Create course", {},  handleCreateCourse)}
                >
                    <AddIcon />
                </IconButton>
              </ToolTip>
            </div>
            <Divider />
            <div className={classes.courseGroup}>
              <Grid container spacing={4}>
                {allCourses.map(({admin_id, name, term, description, _id}, idx) => (
                  admin_id == auth.userInfo._id && 
                  <Grid item key={idx} xs={12} sm={6} md={4}>
                    <Card className={classes.card}>
                      <CardContent className={classes.cardContent}>
                        <Typography gutterBottom variant="h5" component="h2">
                          {name}
                        </Typography>
                        <Typography>
                          {(description && description.length > 100) && (description.substring(0, 100).trim() + '....')}
                          {description && description.length <=100 && description}
                        </Typography>
                        <Typography>
                          Term: {term.toUpperCase()}
                        </Typography>
                      </CardContent>
                      <CardActions disableSpacing >
                        <Button size="small" color="primary">
                          View
                        </Button>
                        {admin_id == auth.userInfo._id && 
                            <section className={classes.iconAlignRight}>
                                <IconButton size="small" 
                                  color="primary" 
                                  // onClick={() => handleOpenModal("Edit course", "Save", {name, term, description}, () => {console.log("EDit")})}
                                  onClick={() => handleOpenModal(
                                                                "Edit course",
                                                                "Save", 
                                                                allCourses[idx],
                                                                ((data) => handleEditCourse(data)))}
                                >
                                    <EditIcon/> 
                                </IconButton>
                                <IconButton  
                                    size="small" 
                                    color="primary" 
                                    onClick={() => {
                                        let isOk = window.confirm("Are you sure to delete this course")
                                        if(isOk)
                                            handleDeleteCourse(_id);
                                    }}
                                >
                                    <DeleteIcon /> 
                                </IconButton>

                            </section>
                        }
                      </CardActions>
                    </Card>
                  </Grid>
                ))}
            </Grid>
            </div>
          </div>
        </Container>
      </main>
    );
}