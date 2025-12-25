const axios = require('axios');

async function test() {
  try {
    const response = await axios.get('http://localhost:8181/api/projects');
    console.log('✓ API Response:', response.data);
    console.log('✓ Project count:', response.data.count);
  } catch (error) {
    console.error('✗ API Error:', error.message);
  }
}

test();
