# Unified Document Viewer

## Goal

Vehicle-related documents are currently distributed across three services within
the organization. The operations team needs a single application to find all
documents associated with a Vehicle Identification Number (VIN), reducing the
time spent searching across systems and helping the team support customers
without overlooking relevant information.

## Mission

**Hypothesis:** Unifying VIN-based document retrieval across the three services
will help the operations team find all relevant documents faster than searching
each service separately.

**Technical artifact:** A reusable document-integration package for the existing
car-knowledge application. It will accept a VIN, retrieve related documents from
the three services, and expose a unified result through a consistent interface.

**Validation:** Compare unified retrieval with separate searches using the same
VINs. Measure search time and document coverage against the known documents in
the mock systems, and verify that the existing car-knowledge application can
consume the package's results.