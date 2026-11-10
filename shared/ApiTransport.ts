/** Both clients send the same challenge events and summaries to the same validator. */
export interface ApiTransport {request<T>(path:string,body?:unknown):Promise<T>}
