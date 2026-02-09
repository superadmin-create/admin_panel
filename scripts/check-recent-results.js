/**
 * Script to check for recent results around a specific time
 */

const http = require('http');

function fetchResults() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/results',
      method: 'GET',
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve(response);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  try {
    console.log('🔍 Checking for recent results...');
    console.log('');

    const response = await fetchResults();

    if (!response.success) {
      console.error('❌ Error:', response.error);
      process.exit(1);
    }

    const results = response.data || [];
    
    console.log(`📊 Total Results: ${results.length}`);
    console.log('');

    // Look for results from Jan 15, 2026
    const jan15Results = results.filter(r => {
      const dateStr = r.timestamp || '';
      return dateStr.includes('Jan 2026') || dateStr.includes('2026-01-15');
    });

    console.log(`📅 Results from Jan 15, 2026: ${jan15Results.length}`);
    console.log('');

    // Show all results from Jan 15, sorted by time
    if (jan15Results.length > 0) {
      console.log('📋 All Results from Jan 15, 2026:');
      console.log('');
      
      jan15Results.forEach((result, index) => {
        console.log(`   ${index + 1}. ${result.studentName}`);
        console.log(`      Subject: ${result.subject}`);
        console.log(`      Score: ${result.score}%`);
        console.log(`      Questions: ${result.questionsAnswered}`);
        console.log(`      Timestamp: ${result.timestamp}`);
        console.log(`      Status: ${result.score >= 50 ? '✅ Passed' : '❌ Failed'}`);
        console.log('');
      });
    }

    // Look specifically for results around 10:41 AM
    const targetTimeResults = results.filter(r => {
      const dateStr = r.timestamp || '';
      return dateStr.includes('10:41') || dateStr.includes('10:41');
    });

    if (targetTimeResults.length > 0) {
      console.log('🕐 Results around 10:41 AM:');
      console.log('');
      targetTimeResults.forEach((result, index) => {
        console.log(`   ${index + 1}. ${result.studentName}`);
        console.log(`      Subject: ${result.subject}`);
        console.log(`      Score: ${result.score}%`);
        console.log(`      Timestamp: ${result.timestamp}`);
        console.log('');
      });
    } else {
      console.log('⚠️  No results found with timestamp containing "10:41"');
      console.log('');
    }

    // Show the 10 most recent results regardless of date
    console.log('📋 10 Most Recent Results (by timestamp):');
    console.log('');
    results.slice(0, 10).forEach((result, index) => {
      console.log(`   ${index + 1}. ${result.studentName}`);
      console.log(`      Subject: ${result.subject}`);
      console.log(`      Score: ${result.score}%`);
      console.log(`      Timestamp: ${result.timestamp}`);
      console.log(`      ID: ${result.id}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('   Make sure the admin_panel server is running on port 3001');
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { fetchResults };
