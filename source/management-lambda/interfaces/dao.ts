// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { AllowedDataModelEntities, AllowedDBEntities, DBEntityType } from "./types";

/**
 * Natural-key fields of a stored item, read for the uniqueness check
 */
export interface KeyRecord {
  PK: string;
  GSI1PK: DBEntityType;
  GSI1SK: string;
  mappingName?: string;
}

/**
 * Generic DAO interface
 * DAO abstracts DDB operations and creates separation of duty with service layer
 * @template T - DDB Entity type
 * @template K - Data Model Entity type
 */
export interface DAO<T extends AllowedDBEntities, K extends AllowedDataModelEntities> {
  /**
   * Get all entities with optional pagination
   * @param {string} nextToken - Optional pagination token
   * @returns {Promise<{items: T[], nextToken?: string}>} Promise of paginated db entities
   */
  getAll(nextToken?: string): Promise<{ items: T[]; nextToken?: string }>;

  /**
   * Get entity by id
   * @param {string} id - Entity id
   * @returns {Promise<T>} Promise of db entity
   */
  get(id: string): Promise<T | null>;

  /**
   * Create entity
   * @param {any} entity - Entity to create
   * @returns {Promise<T>} Promise of created db entity
   */
  create(entity: T): Promise<T>;

  /**
   * Update entity
   * @param {T} entity - Entity to update
   * @returns {Promise<T>} Promise of updated entity
   */
  update(entity: T): Promise<T>;

  /**
   * Delete entity
   * @param {string} id - Entity id
   * @returns {Promise<void>} Promise of void
   */
  delete(id: string): Promise<void>;

  /**
   * Get the natural-key fields of every stored item of this entity type, across all pages
   * @returns {Promise<KeyRecord[]>} Promise of key records
   */
  getKeyRecords(): Promise<KeyRecord[]>;

  /**
   * Get the natural-key fields of one item with a strongly consistent base-table read
   * @param {string} id - Entity id
   * @returns {Promise<KeyRecord | null>} Promise of the key record, or null when the item does not exist
   */
  getKeyRecord(id: string): Promise<KeyRecord | null>;

  /**
   * Convert Data Model entity to DDB entity
   * @param {K} entity - Data Model entity to convert
   * @returns {T} DB entity
   */
  convertToDB(entity: K): T;

  /**
   * Convert DDB entity to Data Model entity
   * @param {T} entity - DB entity
   * @returns {K} Data Model entity
   */
  convertFromDB(entity: T): K;
}
