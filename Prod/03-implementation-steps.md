After grounding the existing systems (which I made up with AI in step [01](./01-fake-the-dealership-systems.md)), it seems we have various forms of API here. Even though they are all REST APIs, they accept different paths and HTTP methods.

I designed the approach for this software in [02](./02-system-design.md), and now I'm going to implement it. I assumed that this system would only be used on a local network, so I didn't mention any kind of authentication or access control in the design step.

So here is the first step: I initiate the .NET 10 application without any authentication.
```bash
cd ../src/
dotnet new webapi --name UnifiedDocuments
```
Then I remove the default files that the .NET CLI scaffolds for me, and try running
```bash
dotnet run --project UnifiedDocuments
```
to check that it works. I add a `.gitignore` to keep the `bin/` and `obj/` folders out of Git, since the .NET CLI does not do this for me.
