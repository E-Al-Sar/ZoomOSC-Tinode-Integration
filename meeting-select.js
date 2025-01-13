import Database from './database.js';
import { promptForMeeting } from './cli.js';
import fs from 'fs';
import path from 'path';

const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'config.json')));
const database = new Database(config);

async function selectMeeting() {
    try {
        await database.connect();
        const recentMeetings = await database.getRecentMeetings();
        const selection = await promptForMeeting(recentMeetings);
        
        if (selection.isNew) {
            const topicName = 'grp' + Math.random().toString(36).substr(2, 9);
            await database.addMeeting(
                selection.meetingId,
                topicName,
                selection.title,
                selection.description
            );
            selection.topic_name = topicName;
        } else {
            await database.updateMeetingLastUsed(selection.meeting_id);
        }
        
        // Write selection to temp file for parent process to read
        fs.writeFileSync(path.join(process.cwd(), 'meeting-selection.tmp'), 
            JSON.stringify(selection));
        
        console.log('\nMeeting selection complete! You can close this window.');
        process.exit(0);
    } catch (err) {
        console.error('Error during meeting selection:', err);
        process.exit(1);
    }
}

console.log('Welcome to Zoom-Tinode Bridge Meeting Selection\n');
console.log('Please select a meeting from the list below or create a new one.\n');

selectMeeting(); 