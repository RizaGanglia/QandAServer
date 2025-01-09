const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const XLSX = require('xlsx'); // Import XLSX package
const fs = require('fs');
const axios = require('axios');

const app = express();
const port = 3001;

// Enable CORS
app.use(cors());
app.use(express.json());

// Configure multer to store the uploaded files in the 'uploads' folder
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

// Gemini API Key (for security, use environment variables in production)

// Function to parse XLSX file
const parseXLSX = (filePath) => {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0]; // Get the first sheet name
  const sheet = workbook.Sheets[sheetName]; // Get the sheet by name
  const jsonData = XLSX.utils.sheet_to_json(sheet); // Convert sheet to JSON
  return jsonData;
};

// After processing the upload
app.post('/uploads', upload.single('file'), (req, res) => {
  const filePath = req.file.path;
  const documentContent = parseXLSX(filePath);  // Parsed data from the uploaded file

  // Store documentContent in the response
  res.json({ documentContent });
});


// Function to query the Gemini API
const queryGeminiAPI = async (question, documentContent) => {
  const apiKey = process.env.GEMINI_API_KEY || GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        parts: [
          {
            text: question,
          },
          {
            text: JSON.stringify(documentContent),  // Include the document content as context
          },
        ],
      },
    ],
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const responseText = response.data?.generatedText || "";

    // Extract just the answer part from the response
    const answerMatch = responseText.match(/(?:Answer:|Answer|Response:)(.*?)(?=\n|$)/s);
    return answerMatch ? answerMatch[1].trim() : "No clear answer found.";

  } catch (error) {
    console.error('Error querying Gemini API:', error.response?.data || error.message);
    throw new Error('Failed to query Gemini API');
  }
};



// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
