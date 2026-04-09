# Design System Strategy: The Clinical Ledger

## 1. Overview & Creative North Star
The "Creative North Star" for this design system is **The Clinical Ledger**. 

In an industry where precision saves lives, the UI must mirror the meticulous nature of a medical journal while maintaining the warmth of a peer-to-peer community. We are moving away from the "generic social app" aesthetic. Instead, we embrace a high-end editorial feel characterized by **asymmetric information density**. This means using expansive white space to frame complex data, treating every screen as a balanced composition rather than a standard grid. We utilize overlapping elements—such as doctor profiles subtly breaking the container bounds—to create a sense of movement and modern authority.

## 2. Colors: Tonal Depth & Atmosphere
This system rejects the "flat" web. We use a palette of sophisticated teals and deep trust-oriented blues to create a hierarchy of reliability.

### The "No-Line" Rule
Standard UI relies on 1px borders to separate content. **In this system, 1px solid borders are prohibited for sectioning.** 
Boundaries must be defined through:
- **Background Shifts:** Use `surface_container_low` for page sections and `surface_container_lowest` for the cards sitting within them.
- **Tonal Transitions:** Define importance through the shift from `surface` to `surface_container_high`.

### Surface Hierarchy & Nesting
Think of the UI as physical layers of fine stationery and frosted glass.
*   **Base Layer:** `surface` (#f7f9fb)
*   **Sectional Layer:** `surface_container_low` (#f2f4f6)
*   **Interactive Layer:** `surface_container_lowest` (#ffffff)
*   **Prominence Layer:** `surface_bright`

### The Glass & Gradient Rule
To ensure the app feels bespoke:
- **Glassmorphism:** Use semi-transparent `surface_container_lowest` (80% opacity) with a `backdrop-blur` (20px) for floating navigation bars or modal overlays.
- **Signature Gradients:** For primary CTAs and hero headers, utilize a subtle linear gradient from `primary` (#006565) to `primary_container` (#008080) at a 135-degree angle. This provides a "lustre" that flat colors cannot replicate.

## 3. Typography: The Editorial Voice
We use **Inter** not as a utility font, but as a branding tool.

*   **Display & Headlines:** Use `display-md` and `headline-lg` with a slightly tighter letter-spacing (-0.02em) to evoke the feeling of a prestigious medical publication.
*   **The Power of Scale:** Create high contrast. Pair a `display-sm` headline with a `label-md` uppercase sub-header. This "Large-and-Small" approach creates an authoritative hierarchy.
*   **Body Text:** `body-lg` is your workhorse. Use a generous line-height (1.6) to ensure medical terminology is legible and reduces cognitive load during professional networking.

## 4. Elevation & Depth: Tonal Layering
Depth is not a "drop shadow"; it is an environmental effect.

*   **The Layering Principle:** Avoid shadows for static content. Achieve lift by placing a `surface_container_lowest` card on a `surface_container_low` background. 
*   **Ambient Shadows:** For floating elements (like a "Start Consultation" FAB), use a wide, diffused shadow: `on_surface` color at 6% opacity, 32px blur, and 8px Y-offset. This mimics natural light.
*   **The "Ghost Border" Fallback:** If a border is required for accessibility (e.g., in high-contrast modes), use the `outline_variant` token at **15% opacity**. It should be felt, not seen.
*   **Backdrop Blur:** When a card overlaps another element, the lower element should be visible through a 12px blur, creating a sense of interconnectedness within the medical community.

## 5. Components

### Cards & Lists
*   **The Card Rule:** No borders. Use `xl` (0.75rem) roundedness.
*   **Spacing over Dividers:** Forbid the use of divider lines in lists. Use `1.5rem` of vertical white space or a subtle shift to `surface_container_low` on hover to separate doctor profiles.
*   **Density:** Use "Nested Information Blocks"—small `surface_variant` containers inside a card to house specific data like "Years of Experience" or "Specialty."

### Buttons & Inputs
*   **Primary Button:** Uses the Signature Gradient. Roundedness set to `md` (0.375rem) to maintain a professional, slightly sharper edge.
*   **Input Fields:** Use `surface_container_high` with no border. Upon focus, transition the background to `surface_container_lowest` with a "Ghost Border" in `primary`.

### Status Indicators (Badges)
*   **Verification Levels:** Use the `secondary` (Trust Blue) for "Verified Physician" badges. 
*   **State Indicators:** Use `tertiary_container` (Copper-Teal) for "Urgent Peer Review" and `primary_fixed` for "Available for Collaboration." 
*   **Style:** Badges should be `full` rounded (pills) with `label-sm` bold typography.

### Context-Specific Components
*   **The "Credential Stack":** A specialized list component that uses `surface_container_low` to group medical certifications, using high-contrast `on_surface_variant` text.
*   **The Case Carousel:** A horizontally scrolling area where cards use `surface_bright` to pop against the background, highlighting peer-reviewed case studies.

## 6. Do's and Don'ts

### Do
*   **Do** use intentional asymmetry. Align a headline to the left but place the supporting action (like a "Filter" chip) significantly offset to the right to create a custom, high-end feel.
*   **Do** use `on_surface_variant` for secondary information to maintain a soft, accessible reading environment.
*   **Do** leverage "Breathing Room." If a screen feels crowded, increase the padding to the next tier in the spacing scale rather than adding lines.

### Don't
*   **Don't** use pure black (#000000) for text. Always use `on_surface` or `on_background` for a softer, more premium look.
*   **Don't** use standard Material Design "elevated" shadows. They feel like templates. Stick to Tonal Layering and Ambient Shadows.
*   **Don't** use 100% opaque borders. They create "visual noise" that distracts from the medical data.