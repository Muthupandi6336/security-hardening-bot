const axios = require('axios');
async function test() {
  try {
    const res = await axios.post('http://ip-api.com/batch', ["8.8.8.8", "1.1.1.1"]);
    console.log(res.data);
  } catch(e) { console.error(e.message); }
}
test();
