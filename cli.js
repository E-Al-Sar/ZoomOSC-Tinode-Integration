import inquirer from 'inquirer';

export async function promptForMeeting(recentMeetings) {
    const choices = recentMeetings.map(meeting => ({
        name: `${meeting.title} (${meeting.meeting_id})`,
        value: meeting
    }));
    
    choices.push({ name: 'New Meeting', value: 'new' });

    const { selection } = await inquirer.prompt([{
        type: 'list',
        name: 'selection',
        message: 'Select a meeting or create new:',
        choices
    }]);

    if (selection === 'new') {
        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'meetingId',
                message: 'Enter the meeting ID:',
                validate: input => input.length > 0
            },
            {
                type: 'input',
                name: 'title',
                message: 'Enter meeting title:',
                validate: input => input.length > 0
            },
            {
                type: 'input',
                name: 'description',
                message: 'Enter meeting description (optional):',
            }
        ]);
        return { isNew: true, ...answers };
    }

    return { isNew: false, ...selection };
} 