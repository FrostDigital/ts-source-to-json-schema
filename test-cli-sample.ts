/**
 * User information
 */
interface User {
  /** User's unique identifier */
  id: string;

  /** User's display name */
  name: string;

  /** User's email address
   * @format email
   */
  email: string;

  /** User's age
   * @minimum 0
   * @maximum 150
   */
  age?: number;

  /** User's tags */
  tags: string[];

  /** User's roles */
  roles: Array<string>;
}

/**
 * API response wrapper
 */
interface ApiResponse {
  success: boolean;
  data: User;
  timestamp: number;
}
