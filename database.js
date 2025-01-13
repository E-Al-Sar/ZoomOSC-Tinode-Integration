import mysql from 'mysql2/promise';

class Database {
    constructor(config) {
        this.config = config;
        this.pool = null;
    }

    async connect() {
        const maxRetries = 5;
        let retryCount = 0;
        
        while (retryCount < maxRetries) {
            try {
                console.log('Database Config:', {
                    host: this.config.database.host,
                    user: this.config.database.user,
                    database: this.config.database.name,
                    attempt: retryCount + 1
                });

                this.pool = mysql.createPool({
                    host: this.config.database.host,
                    user: this.config.database.user,
                    password: this.config.database.password,
                    database: this.config.database.name,
                    port: 3306,
                    waitForConnections: true,
                    connectionLimit: 10,
                    queueLimit: 0,
                    connectTimeout: 10000 // 10 second timeout
                });

                // Test connection
                const [rows] = await this.pool.query('SELECT 1');
                console.log('Database connection successful');

                // Create meetings table if it doesn't exist
                await this.pool.execute(`
                    CREATE TABLE IF NOT EXISTS meetings (
                        id INT PRIMARY KEY AUTO_INCREMENT,
                        meeting_id VARCHAR(255) NOT NULL,
                        topic_name VARCHAR(255) NOT NULL,
                        title VARCHAR(255),
                        description TEXT,
                        last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        UNIQUE KEY unique_meeting (meeting_id)
                    )
                `);
                console.log('Meetings table verified/created');

                return;

            } catch (err) {
                retryCount++;
                console.error('Database Connection Error (Attempt ${retryCount}/${maxRetries}):', {
                    message: err.message,
                    code: err.code,
                    errno: err.errno
                });

                if (retryCount === maxRetries) {
                    throw new Error(`Failed to connect to database after ${maxRetries} attempts: ${err.message}`);
                }

                // Wait before retrying (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
            }
        }
    }

    async getRecentMeetings(limit = 3) {
        try {
            const [rows] = await this.pool.execute(
                'SELECT * FROM meetings ORDER BY last_used DESC LIMIT ?',
                [limit]
            );
            return rows;
        } catch (err) {
            console.error('Failed to get recent meetings:', err);
            throw err;
        }
    }

    async addMeeting(meetingId, topicName, title, description) {
        try {
            await this.pool.execute(
                'INSERT INTO meetings (meeting_id, topic_name, title, description) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE last_used=CURRENT_TIMESTAMP',
                [meetingId, topicName, title, description]
            );
        } catch (err) {
            console.error('Failed to add meeting:', err);
            throw err;
        }
    }

    async updateMeetingLastUsed(meetingId) {
        try {
            await this.pool.execute(
                'UPDATE meetings SET last_used=CURRENT_TIMESTAMP WHERE meeting_id=?',
                [meetingId]
            );
        } catch (err) {
            console.error('Failed to update meeting last_used:', err);
            throw err;
        }
    }

    async getMeetingByTopicName(topicName) {
        try {
            const [rows] = await this.pool.execute(
                'SELECT * FROM meetings WHERE topic_name=? LIMIT 1',
                [topicName]
            );
            return rows[0];
        } catch (err) {
            console.error('Failed to get meeting by topic:', err);
            throw err;
        }
    }
}

export default Database; 