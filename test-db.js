import mysql from 'mysql2/promise';

async function testDatabase() {
    try {
        // Create connection
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: 'example',
            database: 'tinode'
        });
        
        console.log('Successfully connected to MySQL');

        // Test meetings table
        const [rows] = await connection.execute('SHOW TABLES LIKE "meetings"');
        if (rows.length > 0) {
            console.log('Meetings table exists');
            
            // Show table structure
            const [columns] = await connection.execute('DESCRIBE meetings');
            console.log('Table structure:', columns);
            
            // Test insertion
            await connection.execute(
                'INSERT INTO meetings (id, meeting_number, topic, start_time, end_time, duration, participant_count) VALUES (?, ?, ?, NOW(), NOW(), ?, ?)',
                ['test-1', '123456789', 'Test Meeting', 60, 1]
            );
            console.log('Successfully inserted test record');
            
            // Test retrieval
            const [testRows] = await connection.execute('SELECT * FROM meetings');
            console.log('Retrieved records:', testRows);
        } else {
            console.log('Meetings table does not exist');
        }

        await connection.end();
    } catch (err) {
        console.error('Database test failed:', err);
    }
}

testDatabase(); 