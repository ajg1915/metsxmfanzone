/* MetsXMFanZone static site — vanilla JS only, no frameworks. */
(function () {
  "use strict";

  // Mobile menu
  var toggle = document.querySelector(".menu-toggle");
  var mobileNav = document.getElementById("mobile-nav");
  if (toggle && mobileNav) {
    toggle.addEventListener("click", function () {
      var open = mobileNav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    mobileNav.addEventListener("click", function (event) {
      if (event.target.tagName === "A") {
        mobileNav.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && mobileNav.classList.contains("open")) {
        mobileNav.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
  }

  // Accordions / dropdown panels
  document.querySelectorAll(".accordion-trigger").forEach(function (trigger) {
    trigger.addEventListener("click", function () {
      var panel = document.getElementById(trigger.getAttribute("aria-controls"));
      if (!panel) return;
      var expanded = trigger.getAttribute("aria-expanded") === "true";
      trigger.setAttribute("aria-expanded", expanded ? "false" : "true");
      panel.hidden = expanded;
    });
  });

  // Back to top
  var toTop = document.querySelector(".to-top");
  if (toTop) {
    var sync = function () {
      toTop.classList.toggle("show", window.scrollY > 500);
    };
    window.addEventListener("scroll", sync, { passive: true });
    toTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    sync();
  }

  // Simple client-side validation feedback for static forms
  document.querySelectorAll("form[data-static-form]").forEach(function (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var note = form.querySelector(".form-note");
      if (note) {
        note.textContent = "Thanks! This static page does not send messages — use the live site to submit.";
      }
    });
  });
})();
