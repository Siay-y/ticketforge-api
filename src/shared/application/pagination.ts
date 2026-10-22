export interface PageRequest {
  page: number;
  limit: number;
}

export interface Page<T> {
  items: T[];
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export const toPage = <T>(
  items: T[],
  totalItems: number,
  request: PageRequest,
): Page<T> => ({
  items,
  page: request.page,
  limit: request.limit,
  totalItems,
  totalPages: Math.ceil(totalItems / request.limit),
});

export const offsetOf = (request: PageRequest): number =>
  (request.page - 1) * request.limit;
