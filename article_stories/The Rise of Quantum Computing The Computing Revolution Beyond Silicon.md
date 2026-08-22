---
title: "The Rise of Quantum Computing: The Computing Revolution Beyond Silicon"
slug: the-rise-of-quantum-computing
category: Technology
subcategory: Emerging Computing
contentType: guide
description: Quantum computers approach certain problems in a fundamentally different way. What qubits do, where the technology is useful, and why encryption is already changing.
img: article-images/quantum/quantum-computer-chandelier.jpg
alt: Golden chandelier-like cryostat of a superconducting quantum computer, layered with control wiring
date: 2026-08-02
readingTime: 11 min read
featured: true
hero: true
heroOrder: 1
author: Oluwashola Busari
authorSlug: oluwashola-busari
tags: ["quantum computing", "qubits", "post-quantum cryptography", "NIST", "scientific computing"]
hook: Why did the United States rewrite its encryption standards for a machine that does not yet work properly?
directAnswer: Quantum computing uses qubits, which exploit superposition and entanglement, to approach certain classes of problems differently from classical machines. It is a specialised accelerator for particular tasks such as simulation, optimisation and cryptanalysis, not a faster replacement for everyday computers.
keyTakeaways: ["Quantum computers are specialised instruments for particular problems, not general replacements for classical machines.", "The advantage comes from algorithms that exploit interference, not from trying every answer simultaneously as popular accounts suggest.", "The most credible near-term applications are simulating molecules and materials, which are quantum systems already.", "Cryptography is the clearest practical consequence: NIST finalised three post-quantum standards in August 2024 and urges migration now.", "Fragile qubits and the overhead of error correction remain the binding constraints, and useful fault-tolerant machines are not here yet."]
faqs: [{"question":"Will quantum computers replace the computer I am using now?","answer":"No. They are poor at ordinary tasks such as browsing, spreadsheets or video. They are best understood as specialised accelerators attached to classical systems, in the way graphics processors are used today."},{"question":"Do quantum computers try every possible answer at once?","answer":"No, and this is the most persistent misconception. A measurement returns a single outcome. Useful quantum algorithms are designed so that wrong answers cancel out through interference and correct ones reinforce."},{"question":"Should I worry about quantum computers breaking encryption today?","answer":"Not for everyday activity, because no machine capable of it exists publicly. It matters now for data that must stay confidential for a decade or more, because encrypted traffic captured today could be decrypted later."},{"question":"What is a qubit?","answer":"The basic unit of quantum information. Unlike a bit fixed at zero or one, a qubit can occupy a combination of both states until measured, and can be entangled with other qubits so their outcomes are correlated."},{"question":"When will quantum computing be genuinely useful?","answer":"Nobody credible gives a firm date. NIST notes some experts expect a machine capable of breaking current encryption within a decade, but expert opinion varies widely and any specific year should be treated as an estimate."}]
sources: [{"title":"NIST Releases First 3 Finalized Post-Quantum Encryption Standards","publisher":"National Institute of Standards and Technology","publishedAt":"2024-08-13","url":"https://www.nist.gov/news-events/news/2024/08/nist-releases-first-3-finalized-post-quantum-encryption-standards","type":"primary","accessedAt":"2026-08-16","supports":"NIST finalised its principal set of quantum-resistant encryption standards after an eight-year effort, encourages administrators to begin transitioning immediately, and notes that some experts predict a device able to break current encryption could appear within a decade."},{"title":"What Is Post-Quantum Cryptography?","publisher":"National Institute of Standards and Technology","url":"https://www.nist.gov/cybersecurity-and-privacy/what-post-quantum-cryptography","type":"official","accessedAt":"2026-08-16","supports":"NIST's explanation of why current public-key cryptography is vulnerable to quantum attack and what replacing it involves."},{"title":"Elliptic-curve cryptography","publisher":"Wikipedia","url":"https://en.wikipedia.org/wiki/Elliptic-curve_cryptography","type":"reference","accessedAt":"2026-08-16","supports":"Elliptic-curve cryptography underpins widely used protocols including Transport Layer Security and Bitcoin, which is why a quantum attack on it would have broad consequences."}]
seoTitle: "The Rise of Quantum Computing: Beyond Silicon"
seoDescription: What qubits actually do, where quantum computing is genuinely useful, why encryption standards have already changed, and which limits still hold the technology back.
status: published
---
## Introduction

Quantum computing is an approach to computation that uses the behaviour of quantum systems to process certain classes of problem in ways classical machines cannot match. In August 2024 the United States finalised three new encryption standards. No system had been broken and no attack had taken place; the standards were published because of a machine that does not yet work properly.

That is an unusual way for a technology to announce itself. Governments do not normally rewrite the mathematics protecting bank transfers and medical records on the strength of a device still confined to a handful of laboratories, and they did it because the timing of the threat is uncertain while the cost of being late is not.

Quantum computing sits in an awkward position: over-promised in marketing, under-appreciated in what it has genuinely achieved, and surrounded by explanations that are memorable and wrong. It is worth understanding properly, partly because it is interesting, and partly because one of its consequences is already changing the security of systems in daily use.

## How Does a Quantum Computer Work?

### What a classical computer does

Everything a conventional computer does reduces to bits: a bit is definitively zero or one, and enough of them, switched quickly enough, gives every piece of software ever written.

This works extraordinarily well, and for most problems nothing else is needed. However, certain problems have a structure that punishes this approach, because as the problem grows a little, the work grows enormously. Simulating how a modest molecule behaves is the classic example: the molecule does it effortlessly, several times a second, while a classical computer modelling it faithfully runs out of time and memory very quickly.

### What a qubit adds

A quantum bit, or **qubit**, obeys quantum mechanics. Before measurement it can occupy a combination of the zero and one states, a condition known as **superposition**. Qubits can also be **entangled**, meaning their outcomes are correlated in ways that have no classical equivalent.

A popular explanation says that a quantum computer "tries every possible answer at once". It does not, and believing this makes the rest incomprehensible, because a measurement returns a single outcome, not a catalogue of them.

The real mechanism is **interference**. A quantum algorithm is constructed so that the paths leading to wrong answers cancel each other out, while the paths leading to the right answer reinforce. The skill lies in arranging that cancellation, which is why quantum algorithms are rare and hard to design, and only a handful of genuinely useful ones are known.

### What quantum computers are not

Quantum computers are not simply faster computers. For the overwhelming majority of tasks, including everything on a phone, they are worse than the machine already in use, and will remain so. The sensible expectation is a specialised accelerator sitting alongside classical infrastructure, called on for the narrow class of problems it suits, much as graphics processors are used today.

## Why Is Encryption Already Changing?

For researchers, the appeal of quantum computing is direct: nature is quantum mechanical, so simulating it on a machine that is also quantum mechanical removes a translation layer that currently costs enormous computational effort. Chemistry and materials science are the fields where a genuine advantage is most plausible, because the problem and the tool share a structure.

For everyone else, the consequence that has already arrived is cryptographic. Much of the confidentiality on the internet rests on mathematics that is hard for classical computers and, in principle, tractable for a sufficiently large quantum machine. <a href="https://en.wikipedia.org/wiki/Elliptic-curve_cryptography" target="_blank" rel="noopener noreferrer">Elliptic-curve cryptography</a>, one of the main schemes involved, underpins Transport Layer Security and Bitcoin among many other systems.

This is why the <a href="https://www.nist.gov/news-events/news/2024/08/nist-releases-first-3-finalized-post-quantum-encryption-standards" target="_blank" rel="noopener noreferrer">National Institute of Standards and Technology</a> (NIST) finalised replacement standards in August 2024, after an eight-year selection process, and urged administrators to start migrating immediately. NIST notes that some experts expect a machine capable of breaking current encryption within a decade, while being careful to present that as prediction, not schedule.

The urgency has a specific logic that is easy to miss: an adversary can capture encrypted traffic today and store it until a capable machine exists, so for anything that must stay secret for ten or twenty years, such as state communications, medical records or long-lived intellectual property, the risk is not in the future but retrospective.

## Where Is Quantum Computing Useful?

### Chemistry, materials and medicine

This is the strongest case. Simulating molecular behaviour accurately could shorten the path from candidate compound to viable treatment, and inform the design of catalysts, batteries and materials. Progress here is real but early, and most published results are demonstrations on small systems, not discoveries that could not have been made otherwise.

### Optimisation

Logistics, scheduling and portfolio construction all involve searching enormous spaces of possible arrangements. Quantum approaches are being investigated; however, classical methods remain very strong and the evidence of a decisive advantage is not yet there.

### Machine learning

This is an active research area and an overheated marketing one. Some mathematical operations underlying machine learning have quantum analogues, but whether that produces practical benefit on real workloads is unresolved, so claims in this space deserve particular scepticism.

### Cryptanalysis

This is the application driving policy. A large fault-tolerant machine running Shor's algorithm could break widely deployed public-key schemes, and no such machine exists publicly, which is precisely why the migration is happening in advance.

## Benefits and Opportunities

Where the technology suits the problem, the potential gain is not incremental. Being able to model a reaction accurately, not approximately, changes what questions researchers can ask, and that is a different kind of benefit from doing existing work faster.

There is also a substantial adjacent opportunity that requires no quantum hardware at all. The migration to post-quantum cryptography is a large, concrete, and immediate engineering programme: inventorying where cryptography is used, planning replacement, testing interoperability. That work is available now, and it is where most practical demand currently sits.

## What Limits the Technology?

Qubits are exceptionally fragile. Quantum states are disturbed by heat, vibration and stray electromagnetic fields, and many systems operate near absolute zero in heavily isolated environments. That is the reason for the chandelier-like apparatus in photographs of these machines, most of which is refrigeration and wiring, not computing hardware.

Error correction is the central obstacle. Because qubits are noisy, useful computation requires encoding one reliable logical qubit across many physical ones, and the overhead is severe. It is the main reason today's machines cannot run the algorithms most often cited for them.

Cost and access are further constraints. These are laboratory instruments requiring specialist facilities and staff, and although cloud access has widened experimentation, this is not a technology that democratises quickly.

Persistent overstatement is another. Commercial claims frequently outrun demonstrated capability, and "quantum" has become a marketing prefix. A useful test when reading an announcement is whether it reports a problem solved that a classical computer could not have solved, or merely a demonstration that a quantum device performed a task at all.

The timeline is genuinely unknown. Estimates for fault-tolerant machines range from years to decades, and anyone offering a confident date is expressing an opinion, not reporting a finding.

## Conclusion

Quantum computing is neither imminent nor overhyped, which is an unsatisfying position but an accurate one. The engineering is advancing steadily, the fundamental obstacle of error correction remains unsolved at scale, and the most credible near-term uses are narrower and more scientific than the marketing suggests.

What has already changed is worth holding onto, because it is concrete. The world's cryptographic standards were rewritten in anticipation of a machine that does not yet exist, and organisations are migrating now on the reasoning that data stolen today can be read later. That is a rare case of institutions acting well ahead of a threat, and it is the part of this story with practical consequences for systems in use right now.

If quantum computing does mature, the effect will not be that everything gets faster; it will be that a small set of previously unanswerable questions, mostly about how matter behaves, become answerable. That is a narrower claim than the headlines make, and a more interesting one.

The cryptography under discussion here is the same mathematics securing blockchain settlement, which is examined in [stablecoins and the future of digital payments](/articles/stablecoins-and-digital-payments/).
