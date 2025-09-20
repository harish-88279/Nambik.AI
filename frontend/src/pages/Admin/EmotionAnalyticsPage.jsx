import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import { axisClasses } from '@mui/x-charts';

// Hard-coded dataset: number of students by mental health category
const hardcodedData = [
  { category: 'Anxiety', count: 120 },
  { category: 'Depression', count: 85 },
  { category: 'Stress', count: 150 },
  { category: 'PTSD', count: 30 },
  { category: 'OCD', count: 25 },
  { category: 'Bipolar', count: 18 },
];

const EmotionAnalyticsPage = () => {
  const chartParams = {
    dataset: hardcodedData,
    xAxis: [{ scaleType: 'band', dataKey: 'category' }],
    series: [{ dataKey: 'count', label: 'Number of Students' }],
    height: 400,
    margin: { top: 40, right: 20, bottom: 50, left: 60 },
    sx: {
      [`.${axisClasses.left} .${axisClasses.label}`]: {
        transform: 'translateX(-20px)',
      },
    },
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Mental Health Analytics
      </Typography>
      <Paper elevation={3} sx={{ p: 3 }}>
        <BarChart {...chartParams} />
      </Paper>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        Note: This chart uses static sample data for demonstration.
      </Typography>
    </Box>
  );
};

export default EmotionAnalyticsPage;
