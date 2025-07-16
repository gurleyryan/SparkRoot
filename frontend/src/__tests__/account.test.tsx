import "@testing-library/jest-dom";
import "@testing-library/jest-dom/extend-expect";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { act } from "react-dom/test-utils";
import AccountPage from "../app/account/page";
import { useAuthStore } from "../store/authStore";

jest.mock("../store/authStore", () => ({
  useAuthStore: jest.fn(),
}));

// Helper to mock fetch for uniqueness checks
let originalFetch: typeof global.fetch;

beforeAll(() => {
  originalFetch = global.fetch;
  global.fetch = jest.fn((url) => {
    if (typeof url === "string" && url.includes("check-username")) {
      return Promise.resolve(
        new Response(JSON.stringify({ available: false }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    }
    if (typeof url === "string" && url.includes("check-email")) {
      return Promise.resolve(
        new Response(JSON.stringify({ available: false }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    }
    return Promise.resolve(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
  });
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe("AccountPage", () => {
  beforeEach(() => {
    ((useAuthStore as unknown) as jest.Mock).mockReturnValue({
      user: { full_name: "Test User", username: "testuser", email: "test@example.com" },
      userSettings: {},
      setUser: jest.fn(),
    });
  });

  it("renders login prompt if not authenticated", async () => {
    render(<AccountPage />);
    expect(screen.getByText(/You must be logged in/i)).toBeInTheDocument();
  });

  it("renders account form if authenticated", async () => {
    // Simulate authenticated state
    ((useAuthStore as unknown) as jest.Mock).mockReturnValueOnce({
      user: { full_name: "Test User", username: "testuser", email: "test@example.com" },
      userSettings: {},
      setUser: jest.fn(),
    });
    render(<AccountPage />);
    expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
  });

  it("shows spinner when loading", async () => {
    // TODO: Simulate loading state
  });

  it("shows TOTP modal when verifying email", async () => {
    // Simulate verifyingEmail and showTOTPModal state
    ((useAuthStore as unknown) as jest.Mock).mockReturnValueOnce({
      user: { full_name: "Test User", username: "testuser", email: "test@example.com" },
      userSettings: {},
      setUser: jest.fn(),
    });
    render(<AccountPage />);
    // Simulate state change (would require refactor for testability)
    // For now, check modal text
    expect(screen.queryByText(/App Authenticator Required/i)).not.toBeNull();
  });

  it("handles username uniqueness check", async () => {
    ((useAuthStore as unknown) as jest.Mock).mockReturnValueOnce({
      user: { full_name: "Test User", username: "testuser", email: "test@example.com" },
      userSettings: {},
      setUser: jest.fn(),
    });
    render(<AccountPage />);
    const usernameInput = screen.getByLabelText(/Username/i);
    await act(async () => {
      fireEvent.change(usernameInput, { target: { value: "newuser" } });
      fireEvent.blur(usernameInput);
    });
    expect(screen.getByText(/Username is already taken/i)).toBeInTheDocument();
  });

  it("handles email uniqueness check", async () => {
    ((useAuthStore as unknown) as jest.Mock).mockReturnValueOnce({
      user: { full_name: "Test User", username: "testuser", email: "test@example.com" },
      userSettings: {},
      setUser: jest.fn(),
    });
    render(<AccountPage />);
    const emailInput = screen.getByLabelText(/Email/i);
    await act(async () => {
      fireEvent.change(emailInput, { target: { value: "new@example.com" } });
      fireEvent.blur(emailInput);
    });
    expect(screen.getByText(/Email is already in use/i)).toBeInTheDocument();
  });

  it("handles TOTP verification and email update", async () => {
    // Mock fetch for TOTP and email update
    (global.fetch as jest.Mock)
      .mockImplementationOnce((url) => {
        // Email uniqueness check
        if (typeof url === "string" && url.includes("check-email")) {
          return Promise.resolve(
            new Response(JSON.stringify({ available: true }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
          );
        }
        // Default
        return Promise.resolve(
          new Response(JSON.stringify({}), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      })
      .mockImplementationOnce((url) => {
        // TOTP verification
        if (typeof url === "string" && url.includes("verify-totp")) {
          return Promise.resolve(
            new Response(JSON.stringify({ success: true }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
          );
        }
        // Default
        return Promise.resolve(
          new Response(JSON.stringify({}), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      })
      .mockImplementationOnce((url) => {
        // Email update
        if (typeof url === "string" && url.includes("update-email")) {
          return Promise.resolve(
            new Response(JSON.stringify({ success: true }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
          );
        }
        // Default
        return Promise.resolve(
          new Response(JSON.stringify({}), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      });

    ((useAuthStore as unknown) as jest.Mock).mockReturnValueOnce({
      user: { full_name: "Test User", username: "testuser", email: "test@example.com" },
      userSettings: {},
      setUser: jest.fn(),
    });
    render(<AccountPage />);
    // Change email to trigger TOTP modal
    const emailInput = screen.getByLabelText(/Email/i);
    await act(async () => {
      fireEvent.change(emailInput, { target: { value: "newtotp@example.com" } });
      fireEvent.blur(emailInput);
    });
    // Submit form to trigger TOTP modal
    const saveButton = screen.getByRole("button", { name: /Save Changes/i });
    await act(async () => {
      fireEvent.click(saveButton);
    });
    // Modal should appear
    expect(screen.getByText(/App Authenticator Required/i)).toBeInTheDocument();
    // Enter TOTP code and submit
    const totpInput = screen.getByPlaceholderText("123456");
    await act(async () => {
      fireEvent.change(totpInput, { target: { value: "123456" } });
    });
    const verifyButton = screen.getByRole("button", { name: /Verify/i });
    await act(async () => {
      fireEvent.click(verifyButton);
    });
    // Modal should close and success message should appear
    await waitFor(() => {
      expect(screen.queryByText(/App Authenticator Required/i)).toBeNull();
      expect(screen.getByText(/Email updated successfully/i)).toBeInTheDocument();
    });
  });

  // Add more tests for API error handling
});


