// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { AllowedDataModelEntities } from "./types";

/**
 * Generic service interface
 * Provides standard CRUD operations for API that must be implemented by concrete services
 * Inputs are unknown type for service methods
 * @template K - Data Model entity type that extends AllowedDataModelEntities
 */
export interface Service<K extends AllowedDataModelEntities> {
  /**
   * List all entities with optional pagination
   * @param {string} nextToken - Optional pagination token
   * @returns {Promise<{items: K[], nextToken?: string}>} Promise with paginated list of entities
   */
  list(nextToken?: string): Promise<{ items: K[]; nextToken?: string }>;

  /**
   * Create a new entity
   * @param {unknown} createRequest - Raw request data to validate and create entity from
   * @returns {Promise<K>} Promise of created entity
   */
  create(createRequest: unknown): Promise<K>;

  /**
   * Get an entity by ID
   * @param {unknown} id - Entity ID to retrieve
   * @returns {Promise<K>} Promise of requested entity
   */
  get(id: unknown): Promise<K>;

  /**
   * Update an existing entity
   * @param {unknown} id - Entity ID to update
   * @param {unknown} updateRequest - Raw request data to validate and update entity with
   * @returns {Promise<K>} Updated entity
   */
  update(id: unknown, updateRequest: unknown): Promise<K>;

  /**
   * Delete an entity
   * @param {unknown} id - Entity ID to delete
   * @returns {Promise<void>}
   */
  delete(id: unknown): Promise<void>;
}
