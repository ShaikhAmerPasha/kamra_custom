"""One way to read a time of day the database gives back."""


def hhmm(value) -> str:
	"""HH:MM from a time, a timedelta or text. MariaDB gives "8:00:00" for 8 o'clock, one digit short, so
	cutting the first five characters leaves "8:00:" and breaks a later comparison with "09:30"."""
	if not value:
		return ""
	hour, _sep, rest = str(value).partition(":")
	return f"{int(hour):02d}:{rest[:2]}" if hour.strip().isdigit() and rest else ""
