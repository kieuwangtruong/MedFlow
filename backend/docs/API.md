# API Documentation

## Health

### `GET /api/health`

Returns server health information.

Response:

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "status": "OK",
    "timestamp": "2026-07-18T00:00:00.000Z"
  }
}
```

## Auth

### `POST /api/auth/login`

Logs a patient in by CCCD and returns a bearer token for later API requests.

Request:

```json
{
  "cccd": "001204012345"
}
```

Response:

```json
{
  "access_token": "<jwt>",
  "token_type": "Bearer",
  "user": {
    "id": "<patient-id>",
    "full_name": "Benh nhan 001204012345",
    "role": "PATIENT",
    "cccd": "001204012345",
    "patient_token": "<patient-token>"
  }
}
```

Send the token on later requests:

```http
Authorization: Bearer <jwt>
```

### `POST /api/auth/staff/login`

Logs a staff user in by username and password. The username maps to `staff_users.username`.

Request:

```json
{
  "userName": "doctor01",
  "password": "secret"
}
```

Response:

```json
{
  "access_token": "<jwt>",
  "token_type": "Bearer",
  "user": {
    "id": "<staff-id>",
    "full_name": "BS. Nguyen Van A",
    "role": "DOCTOR",
    "email": "doctor@antam.vn",
    "staff_role": "DOCTOR"
  }
}
```
