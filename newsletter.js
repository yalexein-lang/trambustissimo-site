const signupForm = document.querySelector(".newsletter-form");

if (signupForm) {
  const submitButton = signupForm.querySelector('button[type="submit"]');
  const status = signupForm.querySelector(".newsletter-status");

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submitButton.disabled) return;

    const endpoint = new URL(signupForm.action);
    endpoint.searchParams.set("isAjax", "1");
    const payload = new FormData(signupForm);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    submitButton.disabled = true;
    status.dataset.state = "pending";
    status.textContent = "Sending your request…";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        body: payload,
        credentials: "omit",
        signal: controller.signal,
      });
      const result = await response.json();

      if (response.ok && result.success === true) {
        signupForm.reset();
        status.dataset.state = "success";
        status.textContent = "Check your inbox and click the confirmation link to finish subscribing.";
      } else {
        status.dataset.state = "error";
        status.textContent = "Brevo could not complete the request. You can try again using the Brevo form below.";
      }
    } catch {
      status.dataset.state = "error";
      status.textContent = "We couldn’t verify your request. Check your inbox for a confirmation email or use the Brevo form below.";
    } finally {
      clearTimeout(timeout);
      submitButton.disabled = false;
    }
  });
}
