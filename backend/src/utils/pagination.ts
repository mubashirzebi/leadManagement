/**
 * Reusable pagination utility for Express + Mongoose.
 *
 * Usage:
 *   import { parsePagination, buildPaginationMeta, PaginationMeta } from '../utils/pagination';
 *
 *   // In a controller:
 *   const pagination = parsePagination(req.query);
 *   const total = await Model.countDocuments(query);
 *   const docs = await Model.find(query).skip(pagination.skip).limit(pagination.size);
 *   res.json({ success: true, data: docs, pagination: buildPaginationMeta(total, pagination) });
 */

export interface PaginationParams {
  page: number;
  size: number;
  skip: number;
}

export interface PaginationMeta {
  page: number;
  size: number;
  totalRecords: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

const DEFAULT_PAGE = 1;
const DEFAULT_SIZE = 20;
const MAX_SIZE = 100;

/**
 * Parse and validate page & size from Express query object.
 * Returns normalized { page, size, skip }.
 */
export function parsePagination(query: Record<string, any>): PaginationParams {
  let page = parseInt(query.page as string, 10);
  let size = parseInt(query.limit as string, 10);

  // Defaults
  if (isNaN(page) || page < 1) page = DEFAULT_PAGE;
  if (isNaN(size) || size < 1) size = DEFAULT_SIZE;

  // Cap maximum page size
  if (size > MAX_SIZE) size = MAX_SIZE;

  return {
    page,
    size,
    skip: (page - 1) * size,
  };
}

/**
 * Build pagination metadata for the response.
 */
export function buildPaginationMeta(
  totalRecords: number,
  params: Pick<PaginationParams, 'page' | 'size'>
): PaginationMeta {
  const totalPages = Math.ceil(totalRecords / params.size) || 1;

  return {
    page: params.page,
    size: params.size,
    totalRecords,
    totalPages,
    hasNext: params.page < totalPages,
    hasPrev: params.page > 1,
  };
}