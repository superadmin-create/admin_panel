/**
 * Test timestamp parsing and sorting
 */

// Test the timestamp parsing logic
function parseTimestamp(ts) {
  if (!ts) return 0;
  // Try ISO format first (e.g., "2026-01-15T10:11:35.724Z")
  if (ts.includes('T') && ts.includes('Z')) {
    return new Date(ts).getTime();
  }
  // Try formatted string (e.g., "15 Jan 2026, 10:41 am")
  const formattedMatch = ts.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4}),\s+(\d{1,2}):(\d{2})\s+(am|pm)/i);
  if (formattedMatch) {
    const [, day, month, year, hour, minute, ampm] = formattedMatch;
    const monthMap = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };
    let hour24 = parseInt(hour, 10);
    if (ampm.toLowerCase() === 'pm' && hour24 !== 12) hour24 += 12;
    if (ampm.toLowerCase() === 'am' && hour24 === 12) hour24 = 0;
    const date = new Date(
      parseInt(year, 10),
      monthMap[month.toLowerCase()],
      parseInt(day, 10),
      hour24,
      parseInt(minute, 10)
    );
    return date.getTime();
  }
  // Fallback to standard Date parsing
  const parsed = new Date(ts);
  return isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

// Test timestamps
const testTimestamps = [
  "2026-01-15T10:11:35.724Z",
  "15 Jan 2026, 10:41 am",
  "15 Jan 2026, 03:38 pm",
  "15 Jan 2026, 03:37 pm",
];

console.log("Testing timestamp parsing:");
testTimestamps.forEach(ts => {
  const parsed = parseTimestamp(ts);
  const date = new Date(parsed);
  console.log(`  ${ts} -> ${parsed} -> ${date.toLocaleString()}`);
});

console.log("\nSorting test:");
const testResults = [
  { name: "Test 1", timestamp: "2026-01-15T10:11:35.724Z" },
  { name: "Test 2", timestamp: "15 Jan 2026, 10:41 am" },
  { name: "Test 3", timestamp: "15 Jan 2026, 03:38 pm" },
  { name: "Test 4", timestamp: "15 Jan 2026, 03:37 pm" },
];

testResults.sort((a, b) => {
  return parseTimestamp(b.timestamp) - parseTimestamp(a.timestamp);
});

console.log("Sorted order (most recent first):");
testResults.forEach((r, i) => {
  console.log(`  ${i + 1}. ${r.name} - ${r.timestamp}`);
});
