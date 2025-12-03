import { defineEventHandler, readBody } from "h3";

export default defineEventHandler(async (event) => {
  const { searchEndpoint, searchAccessToken } = useRuntimeConfig();
  const { query, variables } = await readBody<{
    query: string;
    variables?: Record<string, any>;
  }>(event);

  try {
    const resp = await $fetch<any>(searchEndpoint!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${searchAccessToken}`,
      },
      body: { query, variables },
    });

    return resp; // { data, errors }
  } catch (error: any) {
    console.error("Smart Search API Error:", {
      status: error.status,
      statusText: error.statusText,
      data: error.data,
      errors: JSON.stringify(error.data?.errors, null, 2),
      message: error.message,
    });
    throw error;
  }
});
