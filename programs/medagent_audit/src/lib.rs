use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("3yPCnb5XQAJcvqmVz1xjUrL9iE24oUAX6LkycfWw5NKX");

#[program]
pub mod medagent_audit {
    use super::*;

    pub fn initialize_audit_log(
        ctx: Context<InitializeAuditLog>,
        patient_hash: String,
        seed: [u8; 32],
    ) -> Result<()> {
        if patient_hash.as_bytes().len() > AuditRecord::HASH_MAX {
            return Err(error!(ErrorCode::PatientHashTooLong));
        }
        let log = &mut ctx.accounts.audit_log;
        log.authority = ctx.accounts.authority.key();
        log.patient_hash = patient_hash;
        log.seed = seed;
        log.bump = ctx.bumps.audit_log;
        log.records = Vec::new();
        Ok(())
    }

    pub fn log_audit_event(
        ctx: Context<LogAuditEvent>,
        params: AuditEventParams,
    ) -> Result<()> {
        if params.event_type.as_bytes().len() > AuditRecord::EVENT_TYPE_MAX
            || params.request_id.as_bytes().len() > AuditRecord::REQUEST_ID_MAX
            || params.doctor_hash.as_bytes().len() > AuditRecord::HASH_MAX
            || params.patient_hash.as_bytes().len() > AuditRecord::HASH_MAX
            || params.jurisdiction.as_bytes().len() > AuditRecord::JURISDICTION_MAX
            || params.timestamp.as_bytes().len() > AuditRecord::TIMESTAMP_MAX
            || params
                .decision
                .as_ref()
                .is_some_and(|value| value.as_bytes().len() > AuditRecord::DECISION_MAX)
            || params
                .token_expiry
                .as_ref()
                .is_some_and(|value| value.as_bytes().len() > AuditRecord::TOKEN_EXPIRY_MAX)
            || params
                .interaction_type
                .as_ref()
                .is_some_and(|value| value.as_bytes().len() > AuditRecord::INTERACTION_TYPE_MAX)
            || params
                .summary_hash
                .as_ref()
                .is_some_and(|value| value.as_bytes().len() > AuditRecord::SUMMARY_HASH_MAX)
            || params
                .fields_accessed
                .as_ref()
                .is_some_and(|value| value.as_bytes().len() > AuditRecord::FIELDS_ACCESSED_MAX)
        {
            return Err(error!(ErrorCode::DataTooLarge));
        }

        let current_records = ctx.accounts.audit_log.records.len();
        let new_space = AuditLog::space_for(current_records + 1);
        let rent = Rent::get()?;
        let new_min_rent = rent.minimum_balance(new_space);
        let current_lamports = ctx.accounts.audit_log.to_account_info().lamports();

        if current_lamports < new_min_rent {
            let lamports_needed = new_min_rent - current_lamports;
            system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.authority.to_account_info(),
                        to: ctx.accounts.audit_log.to_account_info(),
                    },
                ),
                lamports_needed,
            )?;
        }

        ctx.accounts
            .audit_log
            .to_account_info()
            .realloc(new_space, false)?;

        let slot = Clock::get()?.slot;

        let record = AuditRecord {
            event_type: params.event_type.clone(),
            request_id: params.request_id.clone(),
            doctor_hash: params.doctor_hash.clone(),
            patient_hash: params.patient_hash.clone(),
            jurisdiction: params.jurisdiction.clone(),
            decision: params.decision.clone(),
            token_expiry: params.token_expiry.clone(),
            timestamp: params.timestamp.clone(),
            interaction_type: params.interaction_type.clone(),
            summary_hash: params.summary_hash.clone(),
            fields_accessed: params.fields_accessed.clone(),
            duration_seconds: params.duration_seconds,
            slot,
        };

        let log = &mut ctx.accounts.audit_log;
        log.records.push(record);

        emit!(AuditEventEmitted {
            event_type: params.event_type,
            request_id: params.request_id,
            doctor_hash: params.doctor_hash,
            patient_hash: params.patient_hash,
            jurisdiction: params.jurisdiction,
            decision: params.decision,
            token_expiry: params.token_expiry,
            timestamp: params.timestamp,
            interaction_type: params.interaction_type,
            summary_hash: params.summary_hash,
            fields_accessed: params.fields_accessed,
            duration_seconds: params.duration_seconds,
            slot,
        });

        Ok(())
    }

    pub fn close_audit_log(_ctx: Context<CloseAuditLog>) -> Result<()> {
        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct AuditEventParams {
    pub event_type: String,
    pub request_id: String,
    pub doctor_hash: String,
    pub patient_hash: String,
    pub jurisdiction: String,
    pub decision: Option<String>,
    pub token_expiry: Option<String>,
    pub timestamp: String,
    pub interaction_type: Option<String>,
    pub summary_hash: Option<String>,
    pub fields_accessed: Option<String>,
    pub duration_seconds: Option<u32>,
}

#[derive(Accounts)]
#[instruction(patient_hash: String, seed: [u8; 32])]
pub struct InitializeAuditLog<'info> {
    #[account(
        init,
        payer = authority,
        space = AuditLog::space_for(0),
        seeds = [b"medagent_audit", seed.as_ref()],
        bump,
    )]
    pub audit_log: Account<'info, AuditLog>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct LogAuditEvent<'info> {
    #[account(
        mut,
        seeds = [b"medagent_audit", audit_log.seed.as_ref()],
        bump = audit_log.bump,
        has_one = authority,
    )]
    pub audit_log: Account<'info, AuditLog>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseAuditLog<'info> {
    #[account(mut, close = authority, has_one = authority)]
    pub audit_log: Account<'info, AuditLog>,

    #[account(mut)]
    pub authority: Signer<'info>,
}

#[account]
#[derive(Default)]
pub struct AuditLog {
    pub authority: Pubkey,
    pub patient_hash: String,
    pub seed: [u8; 32],
    pub bump: u8,
    pub records: Vec<AuditRecord>,
}

impl AuditLog {
    pub fn space_for(n_records: usize) -> usize {
        8
            + 32
            + (4 + 71)
            + 32
            + 1
            + 4
            + n_records * AuditRecord::MAX_SIZE
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default, Debug)]
pub struct AuditRecord {
    pub event_type: String,
    pub request_id: String,
    pub doctor_hash: String,
    pub patient_hash: String,
    pub jurisdiction: String,
    pub decision: Option<String>,
    pub token_expiry: Option<String>,
    pub timestamp: String,
    pub interaction_type: Option<String>,
    pub summary_hash: Option<String>,
    pub fields_accessed: Option<String>,
    pub duration_seconds: Option<u32>,
    pub slot: u64,
}

impl AuditRecord {
    const EVENT_TYPE_MAX: usize = 32;
    const REQUEST_ID_MAX: usize = 64;
    const HASH_MAX: usize = 71;
    const JURISDICTION_MAX: usize = 32;
    const DECISION_MAX: usize = 64;
    const TOKEN_EXPIRY_MAX: usize = 32;
    const TIMESTAMP_MAX: usize = 40;
    const INTERACTION_TYPE_MAX: usize = 32;
    const SUMMARY_HASH_MAX: usize = 71;
    const FIELDS_ACCESSED_MAX: usize = 256;

    pub const MAX_SIZE: usize =
            (4 + Self::EVENT_TYPE_MAX)
            + (4 + Self::REQUEST_ID_MAX)
            + (4 + Self::HASH_MAX)
            + (4 + Self::HASH_MAX)
            + (4 + Self::JURISDICTION_MAX)
            + (1 + 4 + Self::DECISION_MAX)
            + (1 + 4 + Self::TOKEN_EXPIRY_MAX)
            + (4 + Self::TIMESTAMP_MAX)
            + (1 + 4 + Self::INTERACTION_TYPE_MAX)
            + (1 + 4 + Self::SUMMARY_HASH_MAX)
            + (1 + 4 + Self::FIELDS_ACCESSED_MAX)
            + (1 + 4)  // Option<u32> for duration_seconds
        + 8;
}

#[error_code]
pub enum ErrorCode {
    #[msg("Audit data exceeds maximum allowed size.")]
    DataTooLarge,
    #[msg("Patient hash exceeds maximum allowed size.")]
    PatientHashTooLong,
}

#[event]
pub struct AuditEventEmitted {
    pub event_type: String,
    pub request_id: String,
    pub doctor_hash: String,
    pub patient_hash: String,
    pub jurisdiction: String,
    pub decision: Option<String>,
    pub token_expiry: Option<String>,
    pub timestamp: String,
    pub interaction_type: Option<String>,
    pub summary_hash: Option<String>,
    pub fields_accessed: Option<String>,
    pub duration_seconds: Option<u32>,
    pub slot: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    pub fn patient_hash_seed(patient_hash: &str) -> [u8; 32] {
        let bytes = patient_hash.as_bytes();
        let mut seed = [0u8; 32];
        for (i, b) in bytes.iter().enumerate() {
            seed[i % 32] ^= b;
        }
        let len_bytes = (bytes.len() as u64).to_le_bytes();
        for (i, b) in len_bytes.iter().enumerate() {
            seed[24 + i] ^= b;
        }
        seed
    }

    #[test]
    fn seed_is_deterministic() {
        let h = "sha256:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
        assert_eq!(patient_hash_seed(h), patient_hash_seed(h));
    }

    #[test]
    fn different_hashes_produce_different_seeds() {
        assert_ne!(patient_hash_seed("sha256:aaaa"), patient_hash_seed("sha256:bbbb"),);
    }
}
