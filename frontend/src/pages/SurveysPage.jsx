import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  FormLabel,
  LinearProgress,
  Grid,
} from '@mui/material';
import {
  Assessment as AssessmentIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import LoadingSpinner from '../components/LoadingSpinner';

const SurveysPage = () => {
  const [templates, setTemplates] = useState([]);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openSurvey, setOpenSurvey] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});

  useEffect(() => {
    const loadSurveyData = async () => {
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        setTemplates([
          {
            id: '1',
            name: 'PHQ-9 Depression Screening',
            description: 'A 9-question screening tool for depression severity.',
            surveyType: 'phq9',
            questions: [
              { id: 'q1', text: 'Little interest or pleasure in doing things', options: ['Not at all', 'Several days', 'More than half the days', 'Nearly every day'] },
              { id: 'q2', text: 'Feeling down, depressed, or hopeless', options: ['Not at all', 'Several days', 'More than half the days', 'Nearly every day'] },
              { id: 'q3', text: 'Trouble falling or staying asleep, or sleeping too much', options: ['Not at all', 'Several days', 'More than half the days', 'Nearly every day'] },
            ],
            estimatedTime: 5,
          },
          {
            id: '2',
            name: 'GAD-7 Anxiety Screening',
            description: 'A 7-question screening tool for anxiety severity.',
            surveyType: 'gad7',
            questions: [
              { id: 'q1', text: 'Feeling nervous, anxious, or on edge', options: ['Not at all', 'Several days', 'More than half the days', 'Nearly every day'] },
              { id: 'q2', text: 'Not being able to stop or control worrying', options: ['Not at all', 'Several days', 'More than half the days', 'Nearly every day'] },
              { id: 'q3', text: 'Worrying too much about different things', options: ['Not at all', 'Several days', 'More than half the days', 'Nearly every day'] },
            ],
            estimatedTime: 3,
          },
        ]);

        setResponses([
          {
            id: '1',
            templateName: 'PHQ-9 Depression Screening',
            totalScore: 12,
            riskLevel: 'moderate',
            completedAt: '2024-01-10T14:30:00Z',
          },
          {
            id: '2',
            templateName: 'GAD-7 Anxiety Screening',
            totalScore: 8,
            riskLevel: 'moderate',
            completedAt: '2024-01-08T10:15:00Z',
          },
        ]);
      } catch (error) {
        console.error('Error loading survey data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSurveyData();
  }, []);

  const getRiskLevelColor = (level) => {
    switch (level) {
      case 'low': return 'success';
      case 'moderate': return 'warning';
      case 'high': return 'error';
      case 'severe': return 'error';
      default: return 'default';
    }
  };

  const handleStartSurvey = (template) => {
    setSelectedTemplate(template);
    setCurrentQuestion(0);
    setAnswers({});
    setOpenSurvey(true);
  };

  const handleAnswerChange = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleNextQuestion = () => {
    if (currentQuestion < (selectedTemplate?.questions.length || 0) - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      handleSubmitSurvey();
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  const handleSubmitSurvey = () => {
    // Calculate total score
    const totalScore = Object.values(answers).reduce((sum, score) => sum + score, 0);
    
    // Determine risk level based on score
    let riskLevel = 'low';
    if (selectedTemplate?.surveyType === 'phq9') {
      if (totalScore >= 20) riskLevel = 'severe';
      else if (totalScore >= 15) riskLevel = 'high';
      else if (totalScore >= 10) riskLevel = 'moderate';
    } else if (selectedTemplate?.surveyType === 'gad7') {
      if (totalScore >= 15) riskLevel = 'severe';
      else if (totalScore >= 10) riskLevel = 'high';
      else if (totalScore >= 5) riskLevel = 'moderate';
    }

    // In a real app, you would submit to the API
    console.log('Survey completed:', {
      templateId: selectedTemplate?.id,
      answers,
      totalScore,
      riskLevel,
    });

    setOpenSurvey(false);
    setSelectedTemplate(null);
    setCurrentQuestion(0);
    setAnswers({});
  };

  const progress = selectedTemplate ? ((currentQuestion + 1) / selectedTemplate.questions.length) * 100 : 0;

  if (loading) {
    return <LoadingSpinner message="Loading surveys..." />;
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Wellness Surveys
      </Typography>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Take these self-assessment surveys to better understand your mental health and get personalized recommendations.
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Available Surveys
              </Typography>
              <List>
                {templates.map((template) => (
                  <ListItem key={template.id} divider>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <AssessmentIcon color="primary" />
                          <Typography variant="h6">
                            {template.name}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            {template.description}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Chip
                              label={`${template.estimatedTime} min`}
                              size="small"
                              icon={<ScheduleIcon />}
                            />
                            <Chip
                              label={template.surveyType.toUpperCase()}
                              size="small"
                              variant="outlined"
                            />
                          </Box>
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Button
                        variant="contained"
                        onClick={() => handleStartSurvey(template)}
                      >
                        Start Survey
                      </Button>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Results
              </Typography>
              <List>
                {responses.map((response) => (
                  <ListItem key={response.id} divider>
                    <ListItemText
                      primary={response.templateName}
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Score: {response.totalScore}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                            <Chip
                              label={response.riskLevel}
                              color={getRiskLevelColor(response.riskLevel)}
                              size="small"
                            />
                            <CheckCircleIcon color="success" fontSize="small" />
                          </Box>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={openSurvey} onClose={() => setOpenSurvey(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box>
            <Typography variant="h6">
              {selectedTemplate?.name}
            </Typography>
            <LinearProgress variant="determinate" value={progress} sx={{ mt: 1 }} />
            <Typography variant="caption" color="text.secondary">
              Question {currentQuestion + 1} of {selectedTemplate?.questions.length}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedTemplate && (
            <Box sx={{ mt: 2 }}>
              <FormControl component="fieldset">
                <FormLabel component="legend" sx={{ mb: 2 }}>
                  {selectedTemplate.questions[currentQuestion]?.text}
                </FormLabel>
                <RadioGroup
                  value={answers[selectedTemplate.questions[currentQuestion]?.id] || ''}
                  onChange={(e) => handleAnswerChange(
                    selectedTemplate.questions[currentQuestion]?.id,
                    parseInt(e.target.value)
                  )}
                >
                  {selectedTemplate.questions[currentQuestion]?.options.map((option, index) => (
                    <FormControlLabel
                      key={index}
                      value={index}
                      control={<Radio />}
                      label={option}
                    />
                  ))}
                </RadioGroup>
              </FormControl>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenSurvey(false)}>
            Cancel
          </Button>
          <Button
            onClick={handlePreviousQuestion}
            disabled={currentQuestion === 0}
          >
            Previous
          </Button>
          <Button
            variant="contained"
            onClick={handleNextQuestion}
            disabled={!answers[selectedTemplate?.questions[currentQuestion]?.id]}
          >
            {currentQuestion === (selectedTemplate?.questions.length || 0) - 1 ? 'Submit' : 'Next'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SurveysPage;
