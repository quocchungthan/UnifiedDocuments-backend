using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceSystem.Infrastructure;

namespace ServiceSystem.Controllers;

[ApiController]
[Route("oauth2/token")]
[AllowAnonymous]
[ApiExplorerSettings(IgnoreApi = true)]
public sealed class TokenController(TokenIssuer issuer) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Issue()
    {
        if (!Request.HasFormContentType)
            return BadRequest(new { error = "invalid_request" });

        var form = await Request.ReadFormAsync();
        if (form["grant_type"] != "client_credentials")
            return BadRequest(new { error = "unsupported_grant_type" });

        var (clientId, clientSecret) = TokenIssuer.ReadClient(Request, form);
        if (!issuer.IsValidClient(clientId, clientSecret))
            return Unauthorized(new { error = "invalid_client" });

        return Ok(new { access_token = issuer.Issue(clientId!), token_type = "Bearer", expires_in = issuer.LifetimeSeconds });
    }
}
