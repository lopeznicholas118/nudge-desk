   select count(*) from interactions where source = 'google_calendar';
   select left(refresh_token_encrypted, 30) from google_connections;