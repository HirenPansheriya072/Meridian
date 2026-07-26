class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
    this.expected = true;
  }

  static badRequest(message = 'Bad request', details) {
    return new ApiError(400, message, details);
  }
  static unauthorized(message = 'Not signed in') {
    return new ApiError(401, message);
  }
  static forbidden(message = 'You do not have access to this') {
    return new ApiError(403, message);
  }
  static notFound(message = 'Not found') {
    return new ApiError(404, message);
  }
  static conflict(message = 'Already exists') {
    return new ApiError(409, message);
  }
}

module.exports = ApiError;
