function initializeCollapsibleCards() {
    const cards = document.querySelectorAll(".collapsible-card");

    cards.forEach((card) => {
        const toggle = card.querySelector(".collapse-toggle");
        const content = card.querySelector(".collapsible-card-content");

        if (!toggle || !content) {
            return;
        }

        const icon = toggle.querySelector(".collapse-toggle-icon");
        const label = toggle.querySelector(".collapse-toggle-text");

        const setToggleState = (isExpanded) => {
            toggle.setAttribute("aria-expanded", String(isExpanded));
            toggle.setAttribute("aria-label", isExpanded ? "Minimize this card" : "Expand this card");

            if (icon) {
                icon.textContent = isExpanded ? "−" : "+";
            }

            if (label) {
                label.textContent = isExpanded ? "Minimize" : "Expand";
            }
        };

        content.style.maxHeight = "none";
        setToggleState(true);

        content.addEventListener("transitionend", (event) => {
            if (event.propertyName === "max-height" && !card.classList.contains("is-collapsed")) {
                content.style.maxHeight = "none";
            }
        });

        toggle.addEventListener("click", () => {
            const isCollapsed = card.classList.contains("is-collapsed");

            if (isCollapsed) {
                content.style.maxHeight = "0px";
                card.classList.remove("is-collapsed");
                setToggleState(true);
                window.requestAnimationFrame(() => {
                    content.style.maxHeight = `${content.scrollHeight}px`;
                });
                return;
            }

            content.style.maxHeight = `${content.scrollHeight}px`;
            void content.offsetHeight;

            window.requestAnimationFrame(() => {
                card.classList.add("is-collapsed");
                setToggleState(false);
                content.style.maxHeight = "0px";
            });
        });
    });
}

document.addEventListener("DOMContentLoaded", initializeCollapsibleCards);
