import { NextResponse } from "next/server";
import {
  clearAdminSessionCookie,
  getAdminAccessPassword,
  isAdminAuthenticated,
  setAdminSessionCookie,
} from "../../../lib/admin-auth";

export async function GET() {
  const configured = Boolean(getAdminAccessPassword());
  const authenticated = configured ? await isAdminAuthenticated() : false;

  return NextResponse.json({
    configured,
    authenticated,
    message: configured ? "" : "Set ADMIN_ACCESS_PASSWORD to protect the admin site.",
  });
}

export async function POST(request) {
  const adminPassword = getAdminAccessPassword();

  if (!adminPassword) {
    return NextResponse.json(
      {
        authenticated: false,
        message: "Set ADMIN_ACCESS_PASSWORD before using admin sign-in.",
      },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();
    const password = body.password || "";

    if (!password) {
      return NextResponse.json(
        {
          authenticated: false,
          message: "Admin password is required.",
        },
        { status: 400 },
      );
    }

    if (password !== adminPassword) {
      return NextResponse.json(
        {
          authenticated: false,
          message: "Incorrect admin password.",
        },
        { status: 401 },
      );
    }

    await setAdminSessionCookie();

    return NextResponse.json({
      authenticated: true,
      message: "Signed in successfully.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        authenticated: false,
        message: error.message || "Unable to sign in.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  await clearAdminSessionCookie();

  return NextResponse.json({
    signedOut: true,
    message: "Signed out successfully.",
  });
}
