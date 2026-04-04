export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400,
  ) {
    super(message)
    this.name = "DomainError"
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, id: string) {
    super(`${entity} ${id} not found`, "NOT_FOUND", 404)
  }
}

export class InvalidTransitionError extends DomainError {
  constructor(from: string, event: string) {
    super(`Cannot apply ${event} in state ${from}`, "INVALID_TRANSITION", 409)
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, "CONFLICT", 409)
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = "Unauthorized") {
    super(message, "UNAUTHORIZED", 401)
  }
}
