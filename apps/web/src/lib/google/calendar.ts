import "server-only";
import type {OAuth2Client} from "google-auth-library";
import type {CalendarEvent} from "@nudge/core";

interface EventsPage {
  items?: CalendarEvent[];
  nextPageToken?: string;
}

const MAX_PAGES = 20;

export async function fetchCalendarEvents(
  client: OAuth2Client,
  range: {timeMin: Date; timeMax: Date},
): Promise<CalendarEvent[]> {
  const events: CalendarEvent[] = [];
  let pageToken: string | undefined;
  let pages = 0;

  do {
    const res = await client.request<EventsPage>({
      url: "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      params: {
        timeMin: range.timeMin.toISOString(),
        timeMax: range.timeMax.toISOString(),
        singleEvents: true, // expand recurring events into individual instances
        orderBy: "startTime",
        maxResults: 250,
        // Data minimization: never download descriptions, locations, or conference links.
        fields: "nextPageToken,items(id,status,summary,start,attendees(email,self,resource,responseStatus))",
        ...(pageToken ? {pageToken} : {}),
      },
    });
    events.push(...(res.data.items ?? []));
    pageToken = res.data.nextPageToken;
    pages++;
  } while (pageToken && pages < MAX_PAGES);

  return events;
}