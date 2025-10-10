const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  } else {
    console.log('Connected to SQLite database');
    
    // Check if table exists and get count
    db.get('SELECT COUNT(*) as count FROM discs', (err, row) => {
      if (err) {
        console.error('Error querying database:', err.message);
        if (err.message.includes('no such table')) {
          console.log('Table does not exist yet - database is empty');
        }
        db.close();
      } else {
        console.log('Total discs in database:', row.count);
        
        if (row.count > 0) {
          // Show all entries
          db.all('SELECT * FROM discs ORDER BY created_at DESC', (err, rows) => {
            if (err) {
              console.error('Error fetching rows:', err.message);
            } else {
              console.log('\nDatabase entries:');
              rows.forEach((row, index) => {
                console.log(`${index + 1}. ID: ${row.id}`);
                console.log(`   Owner: ${row.owner_name || 'Unknown'}`);
                console.log(`   Phone: ${row.phone_number}`);
                console.log(`   Disc: ${row.disc_color} ${row.disc_type}`);
                console.log(`   Found: ${row.date_found}`);
                console.log(`   Bin: ${row.bin_number || 'N/A'}`);
                console.log(`   Returned: ${row.is_returned ? 'Yes' : 'No'}`);
                console.log('   ---');
              });
            }
            db.close();
          });
        } else {
          console.log('Database is empty - no discs reported yet');
          db.close();
        }
      }
    });
  }
});