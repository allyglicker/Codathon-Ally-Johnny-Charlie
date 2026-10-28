/* Neur saved demo scenarios, embedded for the client-side pipeline.
 *
 * These mirror demo/scenarios/*.json exactly. They let the public, static
 * build run the whole agent team in the browser (demo mode) with no backend.
 * To add an idea, copy a block, change the values, and keep every number key.
 */
window.NEUR_SCENARIOS = {
  cookies: {
    "scenario": "cookies",
    "keywords": ["cookie", "bake", "bakery", "dessert", "treat", "cake", "brownie"],
    "founder_profile": {
      "idea": "Homemade cookies sold from my kitchen",
      "location": "Milledgeville, GA",
      "startup_budget": 1500,
      "hours_per_week": 10,
      "timeline": "Open within 3 months",
      "experience": "Has baked for 5 years, no business experience"
    },
    "market": {
      "agent": "customer_market",
      "summary": "Steady local demand for fresh homemade cookies at farmers markets, events and in-state online orders. Start at $3.50 a cookie.",
      "key_findings": [
        "Best customers: farmers market shoppers, local event planners and in-state online orders",
        "About 120 customers a month, buying about 3 cookies each, once she's established",
        "Under a cottage food license, sales must go direct to customers (no coffee shops or stores)",
        "Fresh, local and custom orders are how she stands out"
      ],
      "numbers": {
        "price_per_unit": { "value": 3.5, "unit": "USD", "basis": "estimate" },
        "est_monthly_customers": { "value": 120, "unit": "customers/month", "basis": "estimate" },
        "units_per_customer_per_month": { "value": 3, "unit": "cookies/customer/month", "basis": "estimate" },
        "price_range_low": { "value": 3.0, "unit": "USD", "basis": "estimate" },
        "price_range_high": { "value": 4.5, "unit": "USD", "basis": "estimate" }
      },
      "assumptions": [
        "Customer count assumes steady word of mouth after the first month",
        "Competitor count is an estimate; confirm with a local search",
        "No paid marketing at first: word of mouth and free local social media groups"
      ],
      "risks": [
        { "risk": "Demand may drop during college breaks", "severity": "medium" }
      ],
      "needs_from_others": [
        { "agent": "finance", "request": "Check whether $3.50 covers ingredient and packaging costs" }
      ],
      "next_steps": [
        "Have 10 people taste your cookies and say what they would pay",
        "Post in two local community groups to test interest"
      ],
      "unit_definition": "one cookie",
      "signal": "clear",
      "tab": "$3.50/cookie \u00b7 120 customers/mo",
      "responses_to_others": []
    },
    "legal": {
      "agent": "legal",
      "signal": "clear",
      "tab": "$190 setup \u00b7 $175/yr",
      "summary": "You can legally sell homemade cookies from your Milledgeville kitchen with a Georgia Cottage Food License. Expect about $190 to get set up and about $175 a year after that. The big limit is that you can sell only directly to customers, not to stores or coffee shops.",
      "key_findings": [
        "Cookies are allowed under Georgia's Cottage Food License ($100 a year from the Georgia Dept. of Agriculture), so you don't need a commercial kitchen.",
        "You can sell at markets, events and online within Georgia, but not to stores, restaurants or coffee shops, and you can't ship out of state.",
        "Every bag needs a label with your name and address, ingredients, allergens, weight and the state's cottage food statement.",
        "Starting as a sole proprietor costs nothing extra. An LLC would add $110 to file and $60 a year, and it keeps business debts separate from your savings.",
        "You also need a Milledgeville business license, a free EIN (federal tax ID) and a free Georgia sales tax registration."
      ],
      "numbers": {
        "legal_setup_cost": { "value": 190, "unit": "USD", "basis": "estimate", "source": "Georgia Dept. of Agriculture; food handler course; City of Milledgeville (not confirmed)" },
        "annual_license_fees": { "value": 175, "unit": "USD", "basis": "estimate", "source": "Georgia Dept. of Agriculture; City of Milledgeville (not confirmed)" },
        "fee_cottage_food_license": { "value": 100, "unit": "USD", "basis": "calculated", "source": "Georgia Dept. of Agriculture" },
        "fee_food_safety_training": { "value": 15, "unit": "USD", "basis": "estimate", "source": "Typical food handler course price" },
        "fee_city_business_license": { "value": 75, "unit": "USD", "basis": "estimate", "source": "City of Milledgeville (not confirmed)" }
      },
      "assumptions": [
        "Demo mode: legal figures come from Nuer's demo reference card, not a live lookup. Confirm before acting.",
        "Assumed sole proprietorship, since the founder is starting small with no partners.",
        "Milledgeville business license fee is a placeholder estimate; the real fee depends on the city's tax schedule.",
        "Assumed the cookies don't need refrigeration (no cream cheese frosting or custard fillings)."
      ],
      "risks": [
        { "risk": "Selling to coffee shops or stores later would require a licensed commercial kitchen, not the cottage license.", "severity": "medium" },
        { "risk": "Missing the required label statement or allergen list can get product pulled at markets.", "severity": "medium" },
        { "risk": "Local zoning could restrict a home-based business at this address; check before applying.", "severity": "medium" }
      ],
      "needs_from_others": [
        { "agent": "finance", "request": "Add $190 legal setup cost and $175 in annual license fees (both estimates) to the budget." },
        { "agent": "customer_market", "request": "Plan sales channels around direct-to-customer only: markets, events and in-state online orders. No store or coffee shop accounts." }
      ],
      "next_steps": [
        "Call Milledgeville's planning and zoning office to confirm a home-based food business is allowed at your address.",
        "Take an ANSI-accredited food handler course online and save the certificate.",
        "Apply for the Georgia Cottage Food License with the certificate and a notarized affidavit."
      ]
    },
    "finance_raw": {
      "agent": "finance",
      "summary": "Ingredients, bag and label come to about $1.75 per cookie. Market booth fees are the biggest monthly bill.",
      "startup_cost_items": [
        { "item": "Stand mixer", "cost": 300 },
        { "item": "Pans and baking tools", "cost": 150 },
        { "item": "First batch of supplies", "cost": 200 },
        { "item": "Labels and packaging", "cost": 100 },
        { "item": "Logo and simple website", "cost": 100 }
      ],
      "unit_cost_items": [
        { "item": "Ingredients per cookie", "cost": 1.25 },
        { "item": "Bag and label", "cost": 0.4 },
        { "item": "Card fees (about 3%)", "cost": 0.1 }
      ],
      "monthly_fixed_cost_items": [
        { "item": "Farmers market booth fees", "cost": 450 },
        { "item": "Insurance", "cost": 40 },
        { "item": "Website hosting", "cost": 20 }
      ],
      "key_findings": [
        "Ingredients are your biggest per-cookie cost",
        "Monthly bills are low because you bake from home",
        "You keep most of each sale after costs"
      ],
      "assumptions": [
        "Ingredient prices based on typical grocery prices; check two local stores"
      ],
      "risks": [
        { "risk": "Butter and egg prices can swing, which changes your cost per cookie", "severity": "low" }
      ],
      "needs_from_others": [],
      "next_steps": [
        "Price your 3 biggest ingredients at two local stores",
        "Open a separate bank account for the business"
      ],
      "responses_to_others": [
        {
          "agent": "customer_market",
          "request": "Check whether $3.50 covers ingredient and packaging costs",
          "answer": "Yes, but not by much. Ingredients, bag, label and card fees come to about $1.75, so each cookie leaves about $1.75 toward bills."
        }
      ],
      "signal": "clear",
      "tab": "$1,040 start \u00b7 break-even 300/mo"
    },
    "manager": {
      "exchanges": [
        { "from": "Ward", "to": "Penny", "value": "Re-run break-even at $5", "kind": "conflict", "recheck_price": 5 }
      ],
      "roadmap": {
        "one_sentence": "Homemade cookies for Milledgeville shoppers at markets, events and in-state online orders.",
        "verdict": "launch_with_changes",
        "verdict_title": "Launch with changes",
        "verdict_text": "Price at $5 a cookie, keep sales direct to customers, and plan for about 200 cookies a month.",
        "watch_out": [
          {
            "title": "Your hours are the limit",
            "text": "Break-even at $3.50 needs 300 cookies a month, but 10 hours a week lets you bake about 200.",
            "how_found": "Ward compared Penny's break-even with your hours and asked Penny to re-run at $5: break-even drops to 162.",
            "fix": { "label": "Try $5 a cookie", "price": 5 }
          },
          {
            "title": "Direct sales only",
            "text": "Quill found that a cottage food license means selling straight to customers. No coffee shops or stores."
          }
        ],
        "first_steps": [
          "Call the city about zoning for a home bakery",
          "Take a food handler course",
          "Apply for the Cottage Food License",
          "Design your labels",
          "Book your first farmers market"
        ],
        "go_verdict": "Launch with changes: price at $5, sell direct, and plan around about 200 cookies a month."
      }
    }
  },

  "dog-walking": {
    "scenario": "dog-walking",
    "keywords": ["dog", "pet", "walk", "walking", "puppy", "sitting"],
    "founder_profile": {
      "idea": "Dog walking service in my neighborhood",
      "location": "Milledgeville, GA",
      "startup_budget": 1000,
      "hours_per_week": 15,
      "timeline": "Open within 1 month",
      "experience": "Grew up with dogs, no business experience"
    },
    "market": {
      "agent": "customer_market",
      "summary": "Busy working owners and older residents are the most likely customers. A 30-minute walk at $20 is a fair starting price for a local, reliable walker.",
      "key_findings": [
        "Best customers: busy working pet owners and older residents",
        "Regular weekday walks are steadier income than one-off visits",
        "Trust is the main selling point: reviews and a clean background check help",
        "Neighborhood apps and vet office bulletin boards reach owners cheaply"
      ],
      "numbers": {
        "price_per_unit": { "value": 20, "unit": "USD per 30-min walk", "basis": "estimate" },
        "est_monthly_customers": { "value": 15, "unit": "customers/month", "basis": "estimate" },
        "units_per_customer_per_month": { "value": 12, "unit": "walks/customer/month", "basis": "estimate" },
        "price_range_low": { "value": 15, "unit": "USD", "basis": "estimate" },
        "price_range_high": { "value": 25, "unit": "USD", "basis": "estimate" },
        "est_marketing_cost_startup": { "value": 30, "unit": "USD", "basis": "estimate" },
        "est_marketing_cost_monthly": { "value": 0, "unit": "USD/month", "basis": "estimate" }
      },
      "assumptions": [
        "Assumes about 3 walks a week per regular customer"
      ],
      "risks": [
        { "risk": "Big app-based walking services compete on convenience", "severity": "medium" }
      ],
      "needs_from_others": [],
      "next_steps": [
        "Offer a free first walk to 5 neighbors",
        "Ask your first customers for written reviews"
      ],
      "unit_definition": "one 30-minute walk",
      "signal": "clear",
      "tab": "$20/walk \u00b7 15 customers/mo",
      "responses_to_others": []
    },
    "legal": {
      "agent": "legal",
      "summary": "Dog walking has few licensing steps, but liability insurance matters because you are responsible for someone else's pet.",
      "key_findings": [
        "Sole proprietor is the simplest way to start",
        "Get a free EIN (tax ID) from the IRS",
        "Check whether your city requires a general business license",
        "Use a simple written agreement with each client"
      ],
      "numbers": {
        "legal_setup_cost": { "value": 100, "unit": "USD", "basis": "estimate" },
        "annual_license_fees": { "value": 50, "unit": "USD/year", "basis": "estimate" }
      },
      "assumptions": [
        "Fees are estimates; confirm with your city and county"
      ],
      "risks": [
        { "risk": "Without insurance, an injury or lost dog could cost far more than the business earns", "severity": "high" }
      ],
      "needs_from_others": [
        { "agent": "finance", "request": "Include pet-care liability insurance in monthly costs" }
      ],
      "next_steps": [
        "Get quotes for pet-care liability insurance",
        "Write a one-page client agreement"
      ],
      "signal": "clear",
      "tab": "$100 setup \u00b7 $50/yr"
    },
    "finance_raw": {
      "agent": "finance",
      "summary": "Dog walking is cheap to start. Your main ongoing cost is insurance.",
      "startup_cost_items": [
        { "item": "Leashes, bags and treats", "cost": 80 },
        { "item": "Background check", "cost": 30 },
        { "item": "Logo and simple website", "cost": 150 }
      ],
      "unit_cost_items": [
        { "item": "Treats and bags per walk", "cost": 0.4 },
        { "item": "Card fees (about 3%)", "cost": 0.6 }
      ],
      "monthly_fixed_cost_items": [
        { "item": "Pet-care liability insurance", "cost": 45 },
        { "item": "Phone and scheduling app", "cost": 15 },
        { "item": "Website hosting", "cost": 20 }
      ],
      "key_findings": [
        "Very low startup costs",
        "Insurance is the biggest monthly bill",
        "Almost all of each walk's price is yours to keep"
      ],
      "assumptions": [
        "Insurance price is a typical estimate; get real quotes"
      ],
      "risks": [],
      "needs_from_others": [],
      "next_steps": [
        "Get two insurance quotes",
        "Set up a free scheduling and payment app"
      ],
      "responses_to_others": [
        {
          "agent": "legal",
          "request": "Include pet-care liability insurance in monthly costs",
          "answer": "Included: about $45 a month for pet-care liability insurance."
        }
      ],
      "signal": "clear"
    },
    "manager": {
      "exchanges": [
        { "from": "Ward", "to": "Scout", "value": "180 walks in 15 hrs/week?", "kind": "conflict" },
        { "from": "Scout", "to": "Ward", "value": "Offer $30 group walks", "kind": "answer" },
        { "from": "Ward", "to": "Penny", "value": "Re-check at $30", "kind": "request", "recheck_price": 30 }
      ],
      "roadmap": {
        "one_sentence": "Reliable, local dog walks for busy owners in Milledgeville.",
        "verdict": "launch_with_heads_up",
        "verdict_title": "Ready to launch, with one heads-up",
        "verdict_text": "Low costs and steady demand make this a strong first business. Watch your hours before you take on too many clients.",
        "watch_out": [
          {
            "title": "Watch your hours",
            "text": "Scout expects about 180 walks a month. At 30 minutes each plus travel, that may be more than 15 hours a week.",
            "how_found": "Ward compared Scout's demand with your hours, Scout suggested group walks, and Penny re-checked the numbers.",
            "fix": { "label": "Try $30 group walks", "price": 30 }
          },
          {
            "title": "Get insured before your first walk",
            "text": "Quill flagged liability insurance as the most important step, since you are responsible for someone else's pet."
          }
        ],
        "first_steps": [
          "Get two pet-care insurance quotes",
          "Write a one-page client agreement",
          "Offer a free first walk to 5 neighbors",
          "Set up a scheduling and payment app",
          "Ask your first clients for reviews"
        ],
        "go_verdict": "This is one of the easiest businesses to start. Get insured, start with a few neighbors, and use group walks so your hours go further."
      }
    }
  }
};
