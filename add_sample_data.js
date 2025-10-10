const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
    
    // Sample data
    const sampleDiscs = [
      { owner_name: 'John Smith', phone_number: '480-555-0123', disc_type: 'Innova Champion Destroyer', disc_color: 'Blue', bin_number: 1 },
      { owner_name: 'Sarah Johnson', phone_number: '623-555-0456', disc_type: 'Discraft ESP Buzzz', disc_color: 'Orange', bin_number: 2 },
      { owner_name: 'Mike Wilson', phone_number: '602-555-0789', disc_type: 'Dynamic Discs Lucid Truth', disc_color: 'Green', bin_number: 1 },
      { owner_name: 'Emily Davis', phone_number: '480-555-0321', disc_type: 'Innova Star Leopard', disc_color: 'Pink', bin_number: 3 },
      { owner_name: 'Chris Brown', phone_number: '623-555-0654', disc_type: 'Latitude 64 Opto River', disc_color: 'Yellow', bin_number: 2 },
      { owner_name: 'Jessica Lee', phone_number: '602-555-0987', disc_type: 'Discraft Z Force', disc_color: 'Red', bin_number: 1 },
      { owner_name: 'David Garcia', phone_number: '480-555-0147', disc_type: 'Innova DX Aviar', disc_color: 'White', bin_number: 4 },
      { owner_name: 'Amanda Martinez', phone_number: '623-555-0258', disc_type: 'Dynamic Discs Fuzion Verdict', disc_color: 'Purple', bin_number: 3 },
      { owner_name: 'Ryan Thompson', phone_number: '602-555-0369', disc_type: 'Latitude 64 Gold Line Saint', disc_color: 'Lime Green', bin_number: 2 },
      { owner_name: 'Lisa Anderson', phone_number: '480-555-0741', disc_type: 'Discraft Elite X Challenger', disc_color: 'Black', bin_number: 1 }
    ];

    // Clear existing data first
    db.run('DELETE FROM discs', (err) => {
      if (err) {
        console.error('Error clearing data:', err.message);
        return;
      }

      // Insert sample data
      const stmt = db.prepare('INSERT INTO discs (owner_name, phone_number, disc_type, disc_color, bin_number, date_found) VALUES (?, ?, ?, ?, ?, ?)');
      
      sampleDiscs.forEach((disc, index) => {
        const date_found = new Date(Date.now() - index * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // Different dates
        stmt.run(disc.owner_name, disc.phone_number, disc.disc_type, disc.disc_color, disc.bin_number, date_found);
      });
      
      stmt.finalize((err) => {
        if (err) {
          console.error('Error inserting data:', err.message);
        } else {
          console.log('Sample data inserted successfully');
        }
        db.close();
      });
    });
  }
});