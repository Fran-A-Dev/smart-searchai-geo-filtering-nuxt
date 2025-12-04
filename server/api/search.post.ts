// server/api/search.post.ts
import {
  defineEventHandler,
  readBody,
  createError,
  setResponseStatus,
} from "h3";

type GraphQLBody = {
  query?: string;
  variables?: Record<string, any>;
};

type GraphQLResponse<T = unknown> = {
  data?: T;
  errors?: unknown;
};

export default defineEventHandler(async (event) => {
  const { searchEndpoint, searchAccessToken } = useRuntimeConfig();

  if (!searchEndpoint || !searchAccessToken) {
    throw createError({
      statusCode: 500,
      statusMessage: "Smart Search not configured",
    });
  }

  const body = await readBody<GraphQLBody>(event);
  if (!body?.query || typeof body.query !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing GraphQL query",
    });
  }

  try {
    const resp = await $fetch<GraphQLResponse>(searchEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${searchAccessToken}`,
      },
      // Ensure variables is always an object (some servers reject undefined)
      body: { query: body.query, variables: body.variables ?? {} },
    });

    // If GraphQL returned errors, surface them with a 502 so the client can show detail
    if (resp?.errors) {
      setResponseStatus(event, 502);
      return resp;
    }

    return resp; // { data }
  } catch (err: any) {
    // Log enough for debugging without leaking secrets
    console.error("Smart Search API Error", {
      status: err?.status,
      statusText: err?.statusText,
      message: err?.message,
      data: err?.data,
    });

    throw createError({
      statusCode: err?.status || 502,
      statusMessage: "Smart Search request failed",
      data: err?.data ?? null,
    });
  }
});
