import axios from 'axios'
export const runCode = async (language, code) => {
  try {
    const response = await axios.post('https://emkc.org/api/v2/piston/execute', {
      language: language,
      version: '*', 
      files: [{ name: 'main.js', content: code }]  
    });

    console.log('API Response:', response.data); 

    return response.data.run; 
  } catch (err) {
    console.error('Error in runCode:', err);
    throw err;
  }
};
