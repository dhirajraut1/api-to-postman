export interface PostmanHeader {
  key: string;
  value: string;
  disabled?: boolean;
  description?: string;
}

export interface PostmanQueryParam {
  key: string;
  value: string;
  disabled?: boolean;
  description?: string;
}

export interface PostmanVariable {
  key: string;
  value: string;
  type?: "string" | "boolean" | "number" | "any";
  description?: string;
  disabled?: boolean;
}

export interface PostmanUrl {
  raw: string;
  protocol?: string;
  host?: string[];
  path?: string[];
  query?: PostmanQueryParam[];
  variable?: Array<{ key: string; value: string; description?: string }>;
}

export interface PostmanRequest {
  method: string;
  header: PostmanHeader[];
  url: PostmanUrl;
  body?: {
    mode: "raw" | "urlencoded" | "formdata";
    raw?: string;
    urlencoded?: Array<{ key: string; value: string; type?: "text" }>;
    options?: { raw?: { language: "json" | "text" | "xml" } };
  };
  description?: string;
}

export interface PostmanItem {
  name: string;
  request: PostmanRequest;
}

export interface PostmanCollection {
  info: {
    name: string;
    description?: string;
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json";
    _postman_id?: string;
  };
  item: PostmanItem[];
  variable?: PostmanVariable[];
}

export interface PostmanEnvironmentValue {
  key: string;
  value: string;
  type?: "default" | "secret";
  enabled: boolean;
}

export interface PostmanEnvironment {
  id?: string;
  name: string;
  values: PostmanEnvironmentValue[];
  _postman_variable_scope: "environment";
  _postman_exported_at?: string;
  _postman_exported_using?: string;
}
