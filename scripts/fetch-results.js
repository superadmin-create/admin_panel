/**
 * Script to fetch and display viva results from Google Sheets
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
    console.log('🔍 Fetching viva results from Google Sheet...');
    console.log('   Sheet ID: 1dPderiJxJl534xNnzHVVqye9VSx3zZY3ZEgO3vjqpFY');
    console.log('   Sheet Name: Viva Results');
    console.log('');

    const response = await fetchResults();

    if (!response.success) {
      console.error('❌ Error:', response.error);
      process.exit(1);
    }

    console.log('✅ Successfully fetched viva results!');
    console.log('');
    console.log('📊 Summary:');
    console.log(`   Total Results: ${response.count || response.data?.length || 0}`);
    console.log('');

    if (response.data && response.data.length > 0) {
      console.log('📋 Recent Results (first 10):');
      console.log('');

      const recent = response.data.slice(0, 10);
      recent.forEach((result, index) => {
        console.log(`   ${index + 1}. ${result.studentName}`);
        console.log(`      Email: ${result.studentEmail}`);
        console.log(`      Subject: ${result.subject}`);
        console.log(`      Topics: ${result.topics || 'N/A'}`);
        console.log(`      Score: ${result.score}%`);
        console.log(`      Questions: ${result.questionsAnswered}`);
        console.log(`      Date: ${result.timestamp}`);
        console.log(`      Status: ${result.score >= 50 ? '✅ Passed' : '❌ Failed'}`);
        console.log('');
      });

      // Statistics
      const total = response.data.length;
      const passed = response.data.filter(r => r.score >= 50).length;
      const failed = total - passed;
      const avgScore = Math.round(
        response.data.reduce((sum, r) => sum + r.score, 0) / total
      );

      console.log('📈 Statistics:');
      console.log(`   Total Vivas: ${total}`);
      console.log(`   Passed: ${passed} (${Math.round((passed / total) * 100)}%)`);
      console.log(`   Failed: ${failed} (${Math.round((failed / total) * 100)}%)`);
      console.log(`   Average Score: ${avgScore}%`);
      console.log('');

      // Subject breakdown
      const subjectMap = new Map();
      response.data.forEach(result => {
        const subject = result.subject;
        if (!subjectMap.has(subject)) {
          subjectMap.set(subject, { count: 0, totalScore: 0 });
        }
        const stats = subjectMap.get(subject);
        stats.count++;
        stats.totalScore += result.score;
      });

      console.log('📚 Subject Breakdown:');
      Array.from(subjectMap.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .forEach(([subject, stats]) => {
          const avg = Math.round(stats.totalScore / stats.count);
          console.log(`   ${subject}: ${stats.count} vivas, avg ${avg}%`);
        });
    } else {
      console.log('⚠️  No results found in the sheet');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('   Make sure the admin_panel server is running on port 3001');
      console.error('   Run: cd admin_panel && npm run dev');
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { fetchResults };
