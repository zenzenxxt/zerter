
// src/app/api/generate-seb-token/route.ts
import { NextResponse, type NextRequest } from 'next/server';

// Simplified local helper for safe error message extraction for server-side logging
function getLocalSafeServerErrorMessage(e: any, defaultMessage = "An unknown server error occurred."): string {
  if (e && typeof e === 'object') {
    if (typeof e.message === 'string' && e.message.trim() !== '') {
      return e.message;
    }
    try {
      const strError = JSON.stringify(e);
      if (strError !== '{}' && strError.length > 2) return `Error object: ${strError}`;
    } catch (stringifyError) { /* Fall through */ }
  }
  if (e !== null && e !== undefined) {
    const stringifiedError = String(e);
    if (stringifiedError.trim() !== '' && stringifiedError !== '[object Object]') {
      return stringifiedError;
    }
  }
  return defaultMessage;
}


export async function POST(request: NextRequest) {
  const operationId = `[API GenerateSEBToken POST ${Date.now().toString().slice(-5)}]`;
  console.log(`${operationId} Handler started.`);

  let localJwt: any = null;
  // jwtModuleError is used to track if JWT loading specifically failed,
  // allowing us to return a more specific error before the main try block if needed.
  let jwtModuleErrorMsg: string | null = null;

  try {
    // Attempt to load 'jsonwebtoken' module inside the handler
    try {
      console.log(`${operationId} Attempting to load 'jsonwebtoken' module...`);
      localJwt = require('jsonwebtoken');
      if (typeof localJwt.sign !== 'function') {
        // This is a critical failure if the module loads but doesn't have the sign function.
        jwtModuleErrorMsg = 'jsonwebtoken module loaded but localJwt.sign is not a function. Module might be corrupted or not loaded correctly.';
        console.error(`${operationId} CRITICAL: ${jwtModuleErrorMsg}`);
        // This error will be handled by the main try-catch if jwtModuleErrorMsg is checked.
      } else {
        console.log(`${operationId} jsonwebtoken module loaded successfully using require().`);
      }
    } catch (e: any) { // This catches if 'require' itself fails (e.g. module not found at runtime)
      const safeMessage = getLocalSafeServerErrorMessage(e, "Failed to initialize 'jsonwebtoken' module.");
      jwtModuleErrorMsg = `Failed to load 'jsonwebtoken' module at runtime: ${safeMessage}`;
      console.error(`${operationId} CRITICAL: ${jwtModuleErrorMsg}`, e);
      // This error will also be handled by the main try-catch if jwtModuleErrorMsg is checked.
    }

    // If JWT module loading failed, return a specific error immediately.
    if (jwtModuleErrorMsg) {
      return NextResponse.json({ error: `Server configuration error: ${jwtModuleErrorMsg}` }, { status: 500 });
    }
    // Additional check just in case localJwt is null without jwtModuleErrorMsg being set (should not happen with above logic).
    if (!localJwt) {
        return NextResponse.json({ error: "Server configuration error: JWT library critically failed to initialize." }, { status: 500 });
    }


    const currentJwtSecretValue = process.env.NEXT_PUBLIC_JWT_SECRET;
    console.log(`${operationId} Value of process.env.NEXT_PUBLIC_JWT_SECRET at runtime: '${currentJwtSecretValue}' (Type: ${typeof currentJwtSecretValue})`);

    if (!currentJwtSecretValue || currentJwtSecretValue.trim() === '') {
      const errorMsg = 'Server configuration error (JWT secret missing or empty for generation).';
      console.error(`${operationId} CRITICAL: NEXT_PUBLIC_JWT_SECRET is not configured or is empty: '${currentJwtSecretValue}'`);
      return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
    console.log(`${operationId} NEXT_PUBLIC_JWT_SECRET is available (length: ${currentJwtSecretValue?.length || 0}).`);

    let body;
    try {
      console.log(`${operationId} Attempting to parse request body...`);
      body = await request.json();
      console.log(`${operationId} Request body parsed:`, body);
    } catch (parseError: any) {
      const errorMsg = getLocalSafeServerErrorMessage(parseError, "Failed to parse request body as JSON.");
      console.error(`${operationId} Error parsing request body: ${errorMsg}`, parseError);
      return NextResponse.json({ error: `Invalid request body: ${errorMsg}` }, { status: 400 });
    }

    const { studentId, examId } = body;

    if (!studentId || !examId) {
      const errorMsg = "Missing studentId or examId in request body.";
      console.warn(`${operationId} ${errorMsg} Body:`, body);
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }
    console.log(`${operationId} Extracted studentId: ${studentId}, examId: ${examId}`);

    const payload = { studentId, examId, type: 'sebEntry' };
    let token;

    try {
      console.log(`${operationId} Attempting to sign JWT with payload:`, payload);
      token = localJwt.sign(payload, currentJwtSecretValue, { expiresIn: '1h' });
      console.log(`${operationId} JWT signed successfully. Token (first 20 chars): ${token ? token.substring(0,20) + "..." : "TOKEN_GENERATION_FAILED"}`);
    } catch (signError: any) {
      const errorMsg = getLocalSafeServerErrorMessage(signError, "JWT signing process failed.");
      console.error(`${operationId} Error during jwt.sign: ${errorMsg}`, signError);
      return NextResponse.json({ error: `Token generation failed internally: ${errorMsg}` }, { status: 500 });
    }

    console.log(`${operationId} Preparing to send 200 response with token.`);
    return NextResponse.json({ token }, { status: 200 });

  } catch (e: any) {
    // This is the outermost catch block to ensure *something* is returned if an unexpected error occurs
    // that wasn't caught by more specific checks (like JWT loading issues handled above).
    const errorType = typeof e;
    const isErrorObject = e instanceof Error;
    let errorMessageText = "A critical unhandled server error occurred in token generation.";
    
    if (isErrorObject) {
      errorMessageText = e.message || errorMessageText;
    } else if (typeof e === 'string' && e.trim() !== '') {
      errorMessageText = e;
    } else {
      try {
        const stringifiedError = JSON.stringify(e);
        if (stringifiedError !== '{}' && stringifiedError.length > 2) {
            errorMessageText = `Error object: ${stringifiedError}`;
        }
      } catch (stringifyError) { /* Fallback to default if stringify fails */ }
    }
    
    console.error(`${operationId} CRITICAL UNHANDLED EXCEPTION in POST handler: Type: ${errorType}, IsErrorInstance: ${isErrorObject}, Message: ${errorMessageText}. Full Error:`, e);
    
    // Attempt to return a JSON error response
    try {
        return NextResponse.json({ error: "Critical server error during token generation. Please check server logs." }, { status: 500 });
    } catch (responseError: any) {
        // This catch is for the unlikely event that NextResponse.json itself fails.
        console.error(`${operationId} FAILED TO SEND JSON RESPONSE even from outer catch:`, responseError.message, responseError);
        // Fallback to a raw Response if NextResponse.json fails. Next.js might still override this with its own HTML error page.
        return new Response(JSON.stringify({ error: "Critical server error and failed to send standardized JSON response." }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
  }
}

