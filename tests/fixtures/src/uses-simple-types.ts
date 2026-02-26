import { BaseEntity } from "simple-types";

export interface User extends BaseEntity {
  name: string;
  email: string;
}
