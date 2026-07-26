const { refreshGoogleToken, refreshOutlookToken } = require('./externalCalendar');

/**
 * Creates a calendar event on Google or Outlook Calendar and generates a dynamic
 * video meeting link (Google Meet / Microsoft Teams). Falls back to a real Jitsi
 * room link if no calendars are connected.
 */
async function createCalendarEventAndMeeting(booking, hostUser) {
  // 1. Google Calendar Integration (Google Meet)
  if (hostUser.googleCalendar && hostUser.googleCalendar.connected) {
    try {
      const token = await refreshGoogleToken(hostUser._id, hostUser.googleCalendar);
      if (token) {
        console.log(`[video-meeting] Creating Google Calendar event for host: ${hostUser._id}`);
        const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            summary: booking.eventTitle,
            description: booking.attendee.notes || '',
            start: { dateTime: new Date(booking.startAt).toISOString() },
            end: { dateTime: new Date(booking.endAt).toISOString() },
            attendees: [{ email: booking.attendee.email, displayName: booking.attendee.name }],
            conferenceData: {
              createRequest: {
                requestId: String(booking._id),
                conferenceSolutionKey: { type: 'hangoutLink' },
              },
            },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          // Extract hangoutLink (Google Meet URL)
          const meetUrl = data.hangoutLink || data.conferenceData?.entryPoints?.[0]?.uri;
          if (meetUrl) {
            console.log(`[video-meeting] Generated Google Meet link: ${meetUrl}`);
            return meetUrl;
          }
        } else {
          console.error(`[video-meeting] Google Calendar event creation failed: ${await response.text()}`);
        }
      }
    } catch (err) {
      console.error('[video-meeting] Google Meet creation error:', err.message);
    }
  }

  // 2. Outlook Calendar Integration (Microsoft Teams)
  if (hostUser.outlookCalendar && hostUser.outlookCalendar.connected) {
    try {
      const token = await refreshOutlookToken(hostUser._id, hostUser.outlookCalendar);
      if (token) {
        console.log(`[video-meeting] Creating Outlook Calendar event for host: ${hostUser._id}`);
        const response = await fetch('https://graph.microsoft.com/v1.0/me/events', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            subject: booking.eventTitle,
            body: {
              contentType: 'HTML',
              content: booking.attendee.notes || '',
            },
            start: {
              dateTime: new Date(booking.startAt).toISOString(),
              timeZone: 'UTC',
            },
            end: {
              dateTime: new Date(booking.endAt).toISOString(),
              timeZone: 'UTC',
            },
            attendees: [
              {
                emailAddress: {
                  address: booking.attendee.email,
                  name: booking.attendee.name,
                },
                type: 'required',
              },
            ],
            isOnlineMeeting: true,
            onlineMeetingProvider: 'teamsForBusiness',
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const teamsUrl = data.onlineMeeting?.joinUrl;
          if (teamsUrl) {
            console.log(`[video-meeting] Generated Teams link: ${teamsUrl}`);
            return teamsUrl;
          }
        } else {
          console.error(`[video-meeting] Outlook event creation failed: ${await response.text()}`);
        }
      }
    } catch (err) {
      console.error('[video-meeting] Teams creation error:', err.message);
    }
  }

  // 3. Fallback: Generate Jitsi Room (a real, working, free WebRTC video room)
  const roomName = `meridian-${booking.manageToken}`;
  const fallbackUrl = `https://meet.jit.si/${roomName}`;
  console.log(`[video-meeting] Using Jitsi fallback room: ${fallbackUrl}`);
  return fallbackUrl;
}

module.exports = {
  createCalendarEventAndMeeting,
};