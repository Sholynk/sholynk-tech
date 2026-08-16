---
title: Stablecoins and the Future of Digital Payments
slug: stablecoins-and-digital-payments
category: Cryptocurrency
subcategory: Payments and Regulation
contentType: analysis
description: Stablecoins now carry serious payment volume and a US legal framework. This is how they work, what regulators have decided, and why central bankers still object.
img: article-images/stablecoins-and-digital-payments/stablecoin-payment-rails.jpg
alt: A hand holding a smartphone above a shop payment terminal mid-transaction, with faint network lines suggesting settlement moving between two points. Illustration generated with AI for Sholynk.
date: 2026-08-16
readingTime: 10 min read
author: Busari Oluwashola
authorSlug: oluwashola-busari
tags: ["stablecoins", "digital payments", "genius act", "bis", "financial regulation"]
hook: A token that promises to be worth exactly one dollar sounds like the least interesting idea in cryptocurrency. It has turned out to be the one that regulators and central banks are arguing about most.
directAnswer: A stablecoin is a digital token designed to hold a constant value against a reference asset, usually the US dollar, by holding reserves against every token issued. Since 2025 the United States has regulated payment stablecoins under the GENIUS Act, with detailed rules on reserves, capital and redemption.
keyTakeaways: ["A stablecoin holds its value through reserves and redemption, not through the market mechanics that price other crypto assets.", "The GENIUS Act made payment stablecoins a supervised activity in the United States, with implementing rules proposed by the OCC in February 2026.", "Estimates of total stablecoin supply in 2026 differ by provider and date, so any single headline figure should be treated as an estimate rather than a measurement.", "Gross transfer volume is not payments volume; filtered estimates are far smaller than raw on-chain totals.", "The Bank for International Settlements argues stablecoins still fail core tests of money, including singleness and elasticity."]
faqs: [{"question":"What actually keeps a stablecoin worth one dollar?","answer":"Two things: reserves held against every token issued, and the ability to redeem tokens for the underlying currency. If redemption is slow or reserves are doubted, the token can trade below its peg on secondary markets."},{"question":"Are stablecoins the same as a central bank digital currency?","answer":"No. A stablecoin is a private liability issued by a company against reserves. A central bank digital currency would be a direct claim on the central bank, which is a different trust model even where the user experience looks similar."},{"question":"Does regulation make stablecoins safe?","answer":"It reduces specific risks such as inadequate reserves and slow redemption. It does not eliminate run risk, and US regulators have been explicit that holders are not covered by deposit insurance."},{"question":"Why do market size figures vary so much?","answer":"Different providers measure at different dates and count differently, for example whether they include all chains or filter out internal transfers. Reported 2026 figures ranged across the low $300 billions depending on the source."},{"question":"Are stablecoins actually used for payments?","answer":"Increasingly, though most on-chain volume is not retail payment activity. Adjusted figures that filter out bot and internal transfers are substantially lower than raw transfer totals."}]
sources: [{"title":"Implementing the Guiding and Establishing National Innovation for US Stablecoins Act","publisher":"Office of the Comptroller of the Currency, Federal Register","publishedAt":"2026-03-02","url":"https://www.federalregister.gov/documents/2026/03/02/2026-04089/implementing-the-guiding-and-establishing-national-innovation-for-us-stablecoins-act-for-the","type":"primary","accessedAt":"2026-08-16","supports":"Proposed 12 CFR Part 15 requirements including the $5 million minimum capital floor for de novo federal issuers, the $10 billion threshold for transition to federal oversight, and the OCC's use of private forecasts with an upper bound of $500 billion in 2026 issuance."},{"title":"OCC Proposes Regulations to Implement the GENIUS Act","publisher":"Sullivan & Cromwell LLP","publishedAt":"2026-04-06","url":"https://www.sullcrom.com/insights/memo/2026/March/OCC-Proposes-Regulations-Implement-GENIUS-Act","type":"reference","accessedAt":"2026-08-16","supports":"Analysis of the proposed two business day limit on timely redemption and the requirement that issuers with at least $25 billion outstanding hold 0.5% of reserves in insured deposits, capped at $500 million."},{"title":"What You Need To Know About the New Stablecoin Legislation: Analyzing the GENIUS Act","publisher":"Arnold & Porter","publishedAt":"2025-07-21","url":"https://www.arnoldporter.com/en/perspectives/advisories/2025/07/new-stablecoin-legislation-analyzing-the-genius-act","type":"reference","accessedAt":"2026-08-16","supports":"The GENIUS Act permits only issuers below $10 billion in market capitalisation to opt for a state-level regulatory regime, with annual state recertification."},{"title":"BIS says stablecoins fall short as money, warns of emerging-market risks in annual report","publisher":"The Block","publishedAt":"2026-06-28","url":"https://www.theblock.co/post/406466/bis-says-stablecoins-fall-short-as-money-warns-of-emerging-market-risks-in-annual-report","type":"journalism","accessedAt":"2026-08-16","supports":"Reporting on the BIS Annual Economic Report 2026 chapter arguing stablecoins fall short on singleness, elasticity, interoperability and integrity, and modelling a slightly negative medium-term output effect at $1 trillion to $3 trillion in market value."},{"title":"Narrow stablecoins: Redemption, runs, and risk","publisher":"Journal of Economics and Business, ScienceDirect","publishedAt":"2026-03-31","url":"https://www.sciencedirect.com/science/article/pii/S1062976926000384","type":"research","accessedAt":"2026-08-16","supports":"Academic treatment of redemption risk, including the argument that fully collateralised issuers face run risk only where a run forces loss-making asset liquidation."}]
relatedSlugs: ["the-rise-of-quantum-computing", "distraction-by-design", "multimodal-ai-models"]
seoTitle: Stablecoins and the Future of Digital Payments
seoDescription: How stablecoins hold their value, what the GENIUS Act requires of issuers, and why the Bank for International Settlements still argues they fall short as money.
status: published
---
## Introduction

Most cryptocurrency arguments are about price. Stablecoins are the exception, because a stablecoin that moves in price has failed at the one thing it was built to do.

That modesty is precisely why they became consequential. A token engineered to be boring is a token that can be used to pay for something, and payment is the use case that cryptocurrency spent more than a decade promising and rarely delivering. Somewhere in that shift, stablecoins stopped being a trading convenience for moving between exchanges and started attracting the attention of banking regulators, finance ministries and the Bank for International Settlements.

The United States now has a statutory framework for them. The proposed implementing rules run to hundreds of pages. And the central bankers' central bank has published a detailed argument that these instruments still are not money. All three things are true at once, which is what makes the subject worth understanding properly.

## Understanding Stablecoins

### What the token actually is

A stablecoin is a claim. When an issuer creates one token, it undertakes to hold assets of equivalent value in reserve, and to give the holder that value back on request. The token circulates on a blockchain and can be transferred like any other, but the thing anchoring it to a dollar is not the blockchain. It is the reserve and the redemption promise.

This distinguishes it from other crypto assets, whose price is set purely by what someone will pay. It also distinguishes it from a bank deposit, which is a claim on a bank that carries deposit insurance and access to central bank facilities. A stablecoin holder has neither of those protections, a point US regulators have made explicitly.

### Why pegs slip

If the arrangement works, one token trades at one dollar. In practice tokens deviate, and the reasons are instructive. Redemption may be open only to large institutional counterparties, not to ordinary holders. It may take days. The reserve composition may be uncertain. Each of these introduces a gap between the theoretical value and what a buyer will actually pay in a secondary market.

The academic literature frames this as a run problem. Where an issuer holds only cash equivalents, redemption risk arises mainly if a run is large enough to force hurried asset sales at a loss. The reserve's quality, in other words, matters more than its headline size.

### The distinction that gets lost

There is an important separation between a **payment stablecoin**, designed to be spent, and a **yield-bearing token**, designed to pay a return. The US framework regulates the former and bars issuers from paying interest on it. Products that pass through returns from tokenised government debt are a related but legally distinct category, and conflating the two is the most common error in coverage of this sector.

## Why It Matters

Start with the businesses, because their interest is the least ideological. Correspondent banking is slow and expensive at small values, and anyone who has waited three days for a modest cross-border payment to clear understands the appeal of settlement that takes minutes and does not observe weekends. That is an operational complaint, not a political one.

Regulators are looking at the same instrument and seeing a funding question. If deposits drift out of banks and into private tokens, banks have less to lend. The <a href="https://www.bis.org/" target="_blank" rel="noopener noreferrer">Bank for International Settlements</a> (BIS), the institution central banks themselves bank with, put numbers on this, and the numbers are not what either camp expected. Modelling adoption at one, two and three trillion dollars in market value, it found the net effect on output was small, and in its US-calibrated version slightly negative over the medium term. Read that again: the objection is not that stablecoins would blow something up. It is that they would impose real costs while delivering very little growth.

The sharpest version of the argument is playing out in countries with unstable currencies, and it is genuinely uncomfortable. Holding a dollar-referenced token is a sensible decision for one household and a problem when several million make it at once, because it hollows out monetary sovereignty and reshapes how capital moves. The BIS calls this stablecoin dollarisation. Readers in Lagos, Buenos Aires or Istanbul will not need it explained.

## Real-World Applications

Cross-border business settlement is the clearest established use, particularly for payments too small or too frequent to justify correspondent banking fees. Treasury movement between entities of the same group is another, because it involves sophisticated parties who can manage custody.

Card networks and payment processors have begun offering stablecoin payout and settlement options, which matters because it puts the token behind a familiar interface, so merchants never handle it directly.

What remains less established is everyday retail payment. Here the evidence deserves care. Raw on-chain transfer figures are enormous, but they include automated activity, internal transfers between an issuer's own addresses and exchange plumbing. Adjusted estimates that filter this out are substantially lower. Anyone quoting a headline volume figure without saying whether it is raw or adjusted is not telling you much.

## Benefits and Opportunities

The genuine advantages are narrow and real: settlement that does not observe banking hours, programmability that allows a payment to carry conditions, and access to dollar-denominated value for people whose local banking system does not readily provide it.

Regulatory clarity has itself become an opportunity. Institutions that would not touch an unsupervised instrument can consider a federally chartered one, which is why bank subsidiaries and payment companies have entered a market they previously avoided.

## Limitations, Risks and Trade-offs

**The market size figures are softer than they look.** Reported totals for 2026 varied across the low $300 billions depending on the provider and the date. Even the Office of the Comptroller of the Currency (OCC), the US regulator writing the rulebook, worked from private-sector forecasts giving an upper bound of $500 billion for 2026 rather than a measured figure. Treat any precise number as an estimate with a methodology attached.

**Concentration.** The market is dominated by two issuers. Compliance costs tend to entrench incumbents, not diversify a market, and a payment system resting on two private balance sheets carries an obvious single-point-of-failure question.

**No deposit insurance.** This bears repeating because the user experience resembles a bank account. It is not one. US regulators have been clear that token holders are not insured.

**The BIS objection is structural, not technical.** Its argument is that stablecoins fail on singleness, the property that a dollar from one issuer is interchangeable with a dollar from another at par. Different tokens trading at slightly different values reintroduces a problem that nineteenth-century private banknotes had and that modern monetary infrastructure exists to solve. The BIS also argues they fail on elasticity, interoperability across chains, and integrity, given that permissionless rails weaken anti-money-laundering controls.

**Compliance is now a continuous obligation.** Under the <a href="https://www.federalregister.gov/documents/2026/03/02/2026-04089/implementing-the-guiding-and-establishing-national-innovation-for-us-stablecoins-act-for-the" target="_blank" rel="noopener noreferrer">proposed OCC rules</a>, redemption must be timely, with a proposed limit of two business days. Larger issuers face insured-deposit requirements and audit obligations. Enforcement timelines run into 2027, and these are proposals until finalised, so the detail may shift.

## Conclusion

Stablecoins have completed an unusual journey: from a trading utility, to a payments instrument, to a supervised financial activity with capital requirements and a rulebook. That progression is close to what the sector asked for, and it has come with the constraints that supervision always brings.

The BIS question is the one still hanging over all of this. A payment instrument can be useful, properly regulated and widely adopted while still not being money in the way a monetary system needs money to behave, and that gap only shows itself under stress. The next couple of years, as the US rules finalise and enforcement begins, will test the argument, not settle it.

There is a longer-dated risk worth naming too. Stablecoins settle on blockchains secured by <a href="https://en.wikipedia.org/wiki/Elliptic-curve_cryptography" target="_blank" rel="noopener noreferrer">elliptic-curve cryptography</a>, the same mathematics a sufficiently advanced quantum computer could eventually break. Our guide to <a href="/articles/the-rise-of-quantum-computing/" target="_blank" rel="noopener noreferrer">the rise of quantum computing</a> explains how close that threat actually is.
