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

// Function to query the Gemini API
const queryGeminiAPI = async (question, documentContent) => {

  console.log(documentContent," documentContent");
  const apiKey = process.env.GEMINI_API_KEY || GEMINI_API_KEY; // Use API key from environment variable or fallback
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        parts: [
          {
            text: question, // Pass the question here
          },
          {
            text: JSON.stringify(documentContent), // Pass the XLSX content as text (stringified JSON)
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
    console.log('Response from Gemini API:', response.data);
 
    return response.data; // Return the API response
  } catch (error) {
    console.error('Error querying Gemini API:', error.response?.data || error.message);
    throw new Error('Failed to query Gemini API');
  }
};

// Endpoint to handle file upload and parsing
app.post('/uploads', upload.single('file'), (req, res) => {
  console.log(req.file ,"  filew")
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }
  res.status(200).json({ message: 'File uploaded successfully.' });
});

// Endpoint to handle question
app.post('/ask', async (req, res) => {
  const { question } = req.body;

  if (!question) {
    return res.status(400).json({ error: 'Question is required.' });
  }

  try {
    const folderPath = path.join(__dirname, 'uploads');
    const files = fs.readdirSync(folderPath); // Read all files in the uploads folder
    let answers = [];

    // Loop through all files in the uploads folder
    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const fileExtension = path.extname(file).toLowerCase();

      if (fileExtension == '.xlsx') {
        const documentContent = parseXLSX(filePath); // Parse the XLSX file

        // Log the parsed content (for debugging purposes)
        console.log(`Document content for ${file}:`, documentContent);

        // Convert the document content to text format (stringify JSON)
        const contentText = JSON.stringify(documentContent);
        console.log(contentText, "contentText")

        // Query Gemini API with the document content
        const answer = await queryGeminiAPI(question, contentText);
        answers.push({ file, answer });
      }
    }

    // Send response with answers from all files
    if (answers.length > 0) {
      res.status(200).json({ answers });
    } else {
      res.status(404).json({ error: 'No valid .xlsx files found in the uploads folder.' });
    }
  } catch (error) {
    console.error('Error processing question:', error.message);
    res.status(500).json({ error: 'Failed to process the question.' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
