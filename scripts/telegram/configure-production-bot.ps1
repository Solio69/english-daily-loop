[CmdletBinding()]
param(
  [ValidateSet("Configure", "Status", "DeleteWebhook")]
  [string]$Mode = "Configure",

  [string]$MiniAppUrl = "",

  [string]$WebhookUrl = "",

  [switch]$DropPendingUpdates
)

$ErrorActionPreference = "Stop"
$ExpectedBotUsername = "english_daily_loop_bot"
$BotProfilePath = Join-Path $PSScriptRoot "bot-profile.json"
$BotProfile = Get-Content -Raw -Encoding UTF8 -LiteralPath $BotProfilePath |
  ConvertFrom-Json

function ConvertFrom-SecureValue {
  param(
    [Parameter(Mandatory = $true)]
    [Security.SecureString]$Value
  )

  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  }
  finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
}

function Read-RequiredSecret {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Prompt
  )

  $secureValue = Read-Host -Prompt $Prompt -AsSecureString
  $plainValue = ConvertFrom-SecureValue -Value $secureValue
  if ([string]::IsNullOrWhiteSpace($plainValue)) {
    throw "$Prompt is required."
  }
  return $plainValue
}

function Assert-HttpsUrl {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Value,

    [Parameter(Mandatory = $true)]
    [string]$Label
  )

  $parsed = $null
  if (
    -not [Uri]::TryCreate($Value, [UriKind]::Absolute, [ref]$parsed) -or
    $parsed.Scheme -ne "https" -or
    [string]::IsNullOrWhiteSpace($parsed.Host) -or
    -not [string]::IsNullOrEmpty($parsed.UserInfo)
  ) {
    throw "$Label must be a valid HTTPS URL."
  }
}

function Invoke-TelegramBotApi {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Token,

    [Parameter(Mandatory = $true)]
    [string]$Operation,

    [hashtable]$Payload = @{}
  )

  $uri = "https://api.telegram.org/bot$Token/$Operation"
  $jsonBody = $Payload | ConvertTo-Json -Depth 10 -Compress
  $bodyBytes = [Text.Encoding]::UTF8.GetBytes($jsonBody)
  try {
    $response = Invoke-RestMethod `
      -Method Post `
      -Uri $uri `
      -ContentType "application/json; charset=utf-8" `
      -Body $bodyBytes
  }
  catch {
    throw "Telegram Bot API operation '$Operation' failed."
  }

  if ($response.ok -ne $true) {
    throw "Telegram Bot API operation '$Operation' failed."
  }
  return $response.result
}

function Assert-ProductionBot {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Token
  )

  $bot = Invoke-TelegramBotApi -Token $Token -Operation "getMe"
  $actualUsername = [string]$bot.username
  if (
    [string]::IsNullOrWhiteSpace($actualUsername) -or
    -not $actualUsername.Equals(
      $ExpectedBotUsername,
      [StringComparison]::OrdinalIgnoreCase
    )
  ) {
    throw "Refusing to continue: Telegram production bot username mismatch."
  }
  Write-Host "Verified production bot: @$actualUsername"
}

function Write-SafeWebhookStatus {
  param(
    [AllowNull()]
    [object]$WebhookInfo
  )

  $allowedUpdates = @($WebhookInfo.allowed_updates) |
    Where-Object { $_ -is [string] }
  $hasLastError =
    $null -ne $WebhookInfo.last_error_date -or
    $null -ne $WebhookInfo.last_error_message
  $pendingUpdateCount = 0
  if ($null -ne $WebhookInfo.pending_update_count) {
    $pendingUpdateCount = [int]$WebhookInfo.pending_update_count
  }

  [PSCustomObject]@{
    Url = [string]$WebhookInfo.url
    PendingUpdateCount = $pendingUpdateCount
    AllowedUpdates = $allowedUpdates -join ", "
    HasLastError = [bool]$hasLastError
  } | Format-List
}

$botToken = $null
$webhookSecret = $null

try {
  $botToken = Read-RequiredSecret -Prompt "Production Telegram bot token"
  if ($botToken -notmatch '^\d+:[A-Za-z0-9_-]{20,}$') {
    throw "Production Telegram bot token has an invalid format."
  }

  Assert-ProductionBot -Token $botToken

  if ($Mode -eq "Configure") {
    Assert-HttpsUrl -Value $MiniAppUrl -Label "Mini App URL"
    Assert-HttpsUrl -Value $WebhookUrl -Label "Webhook URL"
    $webhookSecret = Read-RequiredSecret -Prompt "Production webhook secret"
    if ($webhookSecret -notmatch '^[A-Za-z0-9_-]{32,256}$') {
      throw "Production webhook secret must contain 32-256 characters: A-Z, a-z, 0-9, _ or -."
    }

    $operations = @(
      @{
        Name = "setMyName"
        Payload = @{ name = $BotProfile.displayName }
      },
      @{
        Name = "setMyShortDescription"
        Payload = @{
          short_description = $BotProfile.shortDescription
        }
      },
      @{
        Name = "setMyDescription"
        Payload = @{
          description = $BotProfile.description
        }
      },
      @{
        Name = "setMyCommands"
        Payload = @{
          commands = @($BotProfile.commands)
          scope = @{ type = "all_private_chats" }
        }
      },
      @{
        Name = "setChatMenuButton"
        Payload = @{
          menu_button = @{
            type = "web_app"
            text = $BotProfile.openAppButtonText
            web_app = @{ url = $MiniAppUrl }
          }
        }
      },
      @{
        Name = "setWebhook"
        Payload = @{
          url = $WebhookUrl
          allowed_updates = @("message")
          secret_token = $webhookSecret
          drop_pending_updates = [bool]$DropPendingUpdates
        }
      }
    )

    foreach ($operation in $operations) {
      Invoke-TelegramBotApi `
        -Token $botToken `
        -Operation $operation.Name `
        -Payload $operation.Payload | Out-Null
      Write-Host "Applied Telegram operation: $($operation.Name)"
    }
  }
  elseif ($Mode -eq "DeleteWebhook") {
    Invoke-TelegramBotApi `
      -Token $botToken `
      -Operation "deleteWebhook" `
      -Payload @{
        drop_pending_updates = [bool]$DropPendingUpdates
      } | Out-Null
    Write-Host "Telegram webhook deleted."
  }

  $webhookInfo = Invoke-TelegramBotApi `
    -Token $botToken `
    -Operation "getWebhookInfo"
  Write-SafeWebhookStatus -WebhookInfo $webhookInfo
}
finally {
  $botToken = $null
  $webhookSecret = $null
}
