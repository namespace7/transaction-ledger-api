function errorMiddleware(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error.status && error.code) {
    return res.status(error.status).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    });
  }

  console.error("Unexpected API error:", error);

  return res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
    },
  });
}

export default errorMiddleware;
