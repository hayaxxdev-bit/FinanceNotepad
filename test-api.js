// test-api.js
// File untuk mengetes API endpoints
// Jalankan: node test-api.js

const API_URL = 'http://localhost:5500/api';

async function testAPI() {
  console.log('🧪 Mulai testing API...\n');

  // 1. Test Health Check
  console.log('1️⃣ Test Health Check...');
  try {
    const healthRes = await fetch(`${API_URL}/health`);
    const healthData = await healthRes.json();
    console.log('✅ Health Check:', healthData);
  } catch (error) {
    console.error('❌ Health Check Failed:', error.message);
  }

  // 2. Test Register
  console.log('\n2️⃣ Test Register...');
  const testEmail = `test${Date.now()}@example.com`;
  const testPassword = 'password123';
  
  try {
    const registerRes = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        fullName: 'Test User'
      })
    });
    const registerData = await registerRes.json();
    console.log('📝 Register:', registerData);
  } catch (error) {
    console.error('❌ Register Failed:', error.message);
  }

  // 3. Test Login
  console.log('\n3️⃣ Test Login...');
  let accessToken = '';
  
  try {
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword
      })
    });
    const loginData = await loginRes.json();
    console.log('🔑 Login:', loginData);
    
    if (loginData.success && loginData.data) {
      accessToken = loginData.data.access_token;
      console.log('✅ Token didapatkan!');
    }
  } catch (error) {
    console.error('❌ Login Failed:', error.message);
  }

  // 4. Test Get Summary (Protected)
  if (accessToken) {
    console.log('\n4️⃣ Test Get Summary...');
    try {
      const summaryRes = await fetch(`${API_URL}/summary?month=1&year=2024`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      const summaryData = await summaryRes.json();
      console.log('📊 Summary:', summaryData);
    } catch (error) {
      console.error('❌ Summary Failed:', error.message);
    }

    // 5. Test Create Transaction
    console.log('\n5️⃣ Test Create Transaction...');
    try {
      const createRes = await fetch(`${API_URL}/transactions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'pemasukan',
          amount: 5000000,
          description: 'Gaji Bulan Januari',
          date: '2024-01-01'
        })
      });
      const createData = await createRes.json();
      console.log('➕ Create Transaction:', createData);
    } catch (error) {
      console.error('❌ Create Transaction Failed:', error.message);
    }

    // 6. Test Get Transactions
    console.log('\n6️⃣ Test Get Transactions...');
    try {
      const getRes = await fetch(`${API_URL}/transactions?month=1&year=2024`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      const getData = await getRes.json();
      console.log('📋 Transactions:', getData);
    } catch (error) {
      console.error('❌ Get Transactions Failed:', error.message);
    }
  }

  console.log('\n✅ Testing selesai!');
}

// Jalankan test
testAPI();